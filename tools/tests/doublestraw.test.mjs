// Silly Straw tier 2: the Slurper runs two straws at once, each on its own dish;
// when one dish dies, that straw frees and re-targets while the other keeps sipping.
// Behavior only — no sip damage numbers asserted.
import { loadEngine, assert, done, makeEnemy, makeTower } from "./_engine.mjs";

const E = loadEngine();
console.log("doublestraw.test — Silly Straw t2 drains 2 dishes; a freed straw re-targets");

E.reset();
const e1 = makeEnemy({ x: 200, y: 100, dist: 300 });   // frontmost
const e2 = makeEnemy({ x: 250, y: 100, dist: 200 });
const e3 = makeEnemy({ x: 300, y: 100, dist: 100 });
E.game.enemies.push(e1, e2, e3);
const sniper = makeTower("sniper", { x: 100, y: 100, range: 500, cooldown: 0.14, damage: 7, drainTargets: 2 });
E.game.towers.push(sniper);

E.updateTowers(0.2);   // latch 2 straws onto the frontmost two and sip both
assert(sniper.slurpTargets.length === 2, "two straws latch on at once");
assert(e1.hp < e1.maxHp && e2.hp < e2.maxHp, "both locked dishes are drained");
assert(e3.hp === e3.maxHp, "the third dish is untouched — only two straws");

// The front dish dies: its straw should free and re-target e3 while the other keeps sipping e2.
const e2before = e2.hp;
E.game.enemies = E.game.enemies.filter((e) => e !== e1);
E.updateTowers(0.2);
assert(!sniper.slurpTargets.includes(e1), "the dead dish's straw is released");
assert(e2.hp < e2before, "the other straw keeps sipping its own dish");
assert(e3.hp < e3.maxHp, "the freed straw re-targets the next dish");

done("doublestraw");
