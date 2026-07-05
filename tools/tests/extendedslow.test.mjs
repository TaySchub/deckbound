// Long Exposure tier 2: the post-freeze slow becomes LONGER and STRONGER. Asserted
// RELATIVE to an unupgraded frost — never absolute numbers, so PR 5 can retune the
// deltas without breaking this test. Exercises applyUpgradeDeltas with the real tiers.
import { loadEngine, assert, done, makeEnemy, makeTower } from "./_engine.mjs";

const E = loadEngine();
console.log("extendedslow.test — Long Exposure t2 makes the after-slow longer AND stronger");

const frostDef = E.TOWER_BY_ID.frost;
const baseFrost = () => makeTower("frost", { x: 100, y: 100, range: 500, cooldown: frostDef.cooldown,
  freezeDur: frostDef.freezeDur, slowDur: frostDef.slowDur, slowFactor: frostDef.slowFactor });

// Freeze one dish with `tower`, let the orb land, and read the slow it leaves behind.
function freezeAndRead(tower) {
  const dish = makeEnemy({ x: 200, y: 100, dist: 100 });
  E.game.enemies = [dish]; E.game.projectiles = [];
  E.fireProjectile(tower, dish);
  let steps = 0;
  while (E.game.projectiles.length && steps < 400) { E.moveProjectiles(1 / 60); steps++; }
  return { slowTimer: dish.slowTimer, slowFactor: dish.slowFactor };
}

E.reset();
const base = freezeAndRead(baseFrost());
const up = baseFrost();
for (const tier of frostDef.upgrades.longExposure.tiers) E.applyUpgradeDeltas(up, tier);   // buy both tiers
const upgraded = freezeAndRead(up);

assert(upgraded.slowTimer > base.slowTimer, "the post-freeze slow lasts LONGER than base");
assert(upgraded.slowFactor < base.slowFactor, "the post-freeze slow is STRONGER (lower factor) than base");

done("extendedslow");
