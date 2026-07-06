// The Pitmaster (Roster Growth 2): locks one dish and ramps a stacking smoke
// DOT on it; Burnt Ends carries stacks to the next lock; Probe Tender executes
// a fully-stacked dish below its HP threshold. Behavior only — every expected
// value is read from the tower the REAL tryBuild/tryUpgrade built.
import { loadEngine, assert, done, makeEnemy } from "./_engine.mjs";

const E = loadEngine();
const { game } = E;
const STEP = 1 / 60;
const ticks = (n) => { for (let i = 0; i < n; i++) E.updateTowers(STEP); };

const buildPit = (paths = []) => {
  E.reset();
  game.towers = [];
  game.currency = 100000;
  game.selectedType = "pit";
  const a = E.MAPS[0].simAnchors[0];
  E.tryBuild(a.x, a.y);
  const t = game.towers[game.towers.length - 1];
  for (const p of paths) E.tryUpgrade(t, p);
  return t;
};

// ---- The smoke stacks toward the tower's cap, and dps rides the stacks ----
let t = buildPit();
const smoked = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6 });
game.enemies.push(smoked);
ticks(1);
let dot = smoked.dots.find((d) => d.src === "smoke");
assert(!!dot && dot.stacks === 1, "the first baste lands 1 smoke stack");
assert(dot.dpsPerStack === t.smokeDps, "the dot's per-stack dps is the tower's LOADED smokeDps");
ticks(Math.ceil(60 * t.cooldown * (t.smokeStacks + 2)));   // plenty of applications
assert(dot.stacks === t.smokeStacks, "stacks ramp to the tower's cap and stop (" + t.smokeStacks + ")");
assert(t.slurpTargets[0] === smoked, "the Pitmaster stays locked on its dish");

// ---- Competition Rub t1 raises the cap ----
t = buildPit(["competitionRub"]);
const rubbed = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6 });
game.enemies.push(rubbed);
ticks(Math.ceil(60 * t.cooldown * (t.smokeStacks + 2)));
assert(rubbed.dots.find((d) => d.src === "smoke").stacks === t.smokeStacks,
  "Competition Rub's higher cap is reachable (" + t.smokeStacks + " stacks)");

// ---- Burnt Ends (The Stall t2): the smoke carries over on a KILL ----
t = buildPit(["theStall", "theStall"]);
assert(t.burntEnds > 0, "The Stall t2 sets the carryover (" + t.burntEnds + " stacks)");
const first = makeEnemy({ x: t.x + 40, y: t.y, dist: 60, hp: 1e6 });
const next = makeEnemy({ x: t.x - 40, y: t.y, dist: 30, hp: 1e6 });
game.enemies.push(first, next);
ticks(1);                                     // lock + smoke the frontmost (first)
assert(t.slurpTargets[0] === first, "locked the frontmost dish");
E.applyDamage(first, 1e9);                    // it dies smoked
ticks(1);                                     // re-lock → the carryover lands
const carried = next.dots.find((d) => d.src === "smoke");
assert(!!carried && carried.stacks === Math.min(t.smokeStacks, t.burntEnds),
  "the next locked dish starts pre-smoked with the carried stacks");

// ---- No carryover when the smoked dish LEAKS instead of dying ----
t = buildPit(["theStall", "theStall"]);
const leaker = makeEnemy({ x: t.x + 40, y: t.y, dist: 60, hp: 1e6 });
const after = makeEnemy({ x: t.x - 40, y: t.y, dist: 30, hp: 1e6 });
game.enemies.push(leaker, after);
ticks(1);
leaker.reachedCore = true;                    // it escaped into the dish return
game.enemies = game.enemies.filter((e) => e !== leaker);
ticks(1);
const noCarry = after.dots.find((d) => d.src === "smoke");
assert(!noCarry || noCarry.stacks <= 1, "a LEAKED dish carries nothing over (fresh smoke only)");

// ---- Probe Tender (Competition Rub t2): execute below the threshold… ----
t = buildPit(["competitionRub", "competitionRub"]);
assert(t.probeThreshold > 0, "Competition Rub t2 sets the execute threshold (" + t.probeThreshold + ")");
const tender = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6, bounty: 9 });
tender.maxHp = 1000; tender.hp = tender.maxHp * t.probeThreshold * 0.5;   // well below
game.enemies.push(tender);
for (let i = 0; i < t.smokeStacks; i++) E.applyDot(tender, "smoke", { dpsPerStack: t.smokeDps, duration: 10, maxStacks: t.smokeStacks });
const cash = game.currency;
ticks(1);   // the next baste probes it → finished
assert(!game.enemies.includes(tender), "a fully-stacked dish below the threshold is finished on the spot");
assert(game.currency === cash + 9, "the execute is a normal death — bounty paid");

// ---- …and NOT above it ----
t = buildPit(["competitionRub", "competitionRub"]);
const tough = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6 });
tough.maxHp = 1000; tough.hp = 900;   // far above the threshold
game.enemies.push(tough);
for (let i = 0; i < t.smokeStacks; i++) E.applyDot(tough, "smoke", { dpsPerStack: t.smokeDps, duration: 10, maxStacks: t.smokeStacks });
ticks(1);
assert(game.enemies.includes(tough), "a healthy dish at full stacks is NOT executed");

done("pitmaster");
