// The Ranch Fountain (Roster Growth 2): a cone spray that coats every dish in
// it with a stacking slow + light DOT; Extra Dressing deepens the slow to its
// floor; Ranch Keg drenches the cone to instant max slow. Behavior only.
import { loadEngine, assert, done, makeEnemy } from "./_engine.mjs";

const E = loadEngine();
const { game } = E;
const STEP = 1 / 60;
const ticks = (n) => { for (let i = 0; i < n; i++) E.updateTowers(STEP); };

const buildRanch = (paths = []) => {
  E.reset();
  game.towers = [];
  game.currency = 100000;
  game.selectedType = "ranch";
  const a = E.MAPS[0].simAnchors[0];
  E.tryBuild(a.x, a.y);
  const t = game.towers[game.towers.length - 1];
  for (const p of paths) E.tryUpgrade(t, p);
  return t;
};

// ---- The cone hits ONLY in-cone dishes ----
let t = buildRanch();
// The fountain aims at its frontmost dish (targeting "first"): put it dead
// ahead (+x); one hugging the aim line, one at a right angle behind the cone.
const ahead = makeEnemy({ x: t.x + 60, y: t.y, dist: 90, hp: 1e6 });
const nearAim = makeEnemy({ x: t.x + 70, y: t.y + 20, dist: 50, hp: 1e6 });   // ~16° off aim — inside
const behind = makeEnemy({ x: t.x - 60, y: t.y, dist: 10, hp: 1e6 });          // 180° — way outside
const above = makeEnemy({ x: t.x, y: t.y - 60, dist: 5, hp: 1e6 });            // 90° — outside a 28° half-cone
game.enemies.push(ahead, nearAim, behind, above);
ticks(1);
assert(!!ahead.dots.find((d) => d.src === "ranch"), "the aimed-at dish is coated");
assert(!!nearAim.dots.find((d) => d.src === "ranch"), "a dish inside the cone is coated too");
assert(!behind.dots.find((d) => d.src === "ranch"), "a dish BEHIND the fountain is untouched");
assert(!above.dots.find((d) => d.src === "ranch"), "a dish outside the cone angle is untouched");

// ---- The coat is a slow + a light DOT, and it stacks ----
const coat = ahead.dots.find((d) => d.src === "ranch");
assert(coat.slowPerStack === t.slowPerStack && coat.dps === t.ranchDps,
  "the coat carries the tower's LOADED slow-per-stack and drizzle dps");
const before = E.statusSlowFactor(ahead);
ticks(Math.ceil(60 * t.cooldown * 2));
assert(E.statusSlowFactor(ahead) < before, "more coats → a deeper slow");

// ---- Extra Dressing t1: the stacked slow bottoms out at the floor ----
t = buildRanch(["extraDressing"]);
const drenched = makeEnemy({ x: t.x + 60, y: t.y, dist: 50, hp: 1e6 });
game.enemies.push(drenched);
ticks(Math.ceil(60 * t.cooldown * (t.ranchStacks + 2)));
const floorFactor = Math.max(t.slowFloor, 1 - t.slowPerStack * t.ranchStacks);
assert(Math.abs(E.statusSlowFactor(drenched) - floorFactor) < 1e-9,
  "at max coats the slow sits exactly at max(floor, 1 − perStack·cap) = " + floorFactor);
assert(E.statusSlowFactor(drenched) >= t.slowFloor - 1e-9, "…and never below the floor cap");

// ---- Ranch Keg t2: the FIRST burst applies max slow instantly ----
t = buildRanch(["widerNozzle", "widerNozzle"]);
assert(t.kegPeriod > 0, "Wider Nozzle t2 arms the keg (period " + t.kegPeriod + "s)");
const kegged = makeEnemy({ x: t.x + 60, y: t.y, dist: 50, hp: 1e6 });
game.enemies.push(kegged);
ticks(1);   // one spray, keg ready → instant drench
const kd = kegged.dots.find((d) => d.src === "ranch");
assert(!!kd && kd.stacks === kd.maxStacks, "the keg burst drenches to MAX stacks in one spray");
assert(t.kegTimer > 0, "the keg then goes on cooldown");

done("ranch");
