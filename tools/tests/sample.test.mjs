// The Sample Lady (Roster Growth 2): a brief plain stun + the AMP mark that
// makes EVERY tower hit harder; Loss Leader pays bonus Tips when a marked dish
// dies; Bulk Buy marks several dishes at once. Behavior only.
import { loadEngine, assert, done, makeEnemy } from "./_engine.mjs";

const E = loadEngine();
const { game } = E;
const STEP = 1 / 60;
const ticks = (n) => { for (let i = 0; i < n; i++) E.updateTowers(STEP); };

const buildSample = (paths = []) => {
  E.reset();
  game.towers = [];
  game.currency = 100000;
  game.selectedType = "sample";
  const a = E.MAPS[0].simAnchors[0];
  E.tryBuild(a.x, a.y);
  const t = game.towers[game.towers.length - 1];
  for (const p of paths) E.tryUpgrade(t, p);
  return t;
};

// ---- A sample = tiny nibble + brief PLAIN stun + the amp mark ----
let t = buildSample();
const tasting = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6 });
game.enemies.push(tasting);
ticks(1);
assert(tasting.ampMul === t.ampMul, "the mark lands with the tower's LOADED multiplier (" + t.ampMul + "x)");
assert(tasting.freezeTimer > 0 && tasting.freezePlain === true,
  "the dish stops for a bite — a PLAIN stun (no Photographer brackets)");
assert(1e6 - tasting.hp === t.damage * 1, "the nibble itself is the tower's small loaded damage");

// ---- The mark makes ANOTHER tower's hit land harder ----
const hpBefore = tasting.hp;
E.applyDamage(tasting, 100);   // any other source
assert(Math.abs((hpBefore - tasting.hp) - 100 * t.ampMul) < 1e-9,
  "another tower's 100 damage lands as " + 100 * t.ampMul + " on the marked dish");

// ---- A Photographer snapshot AFTER a sample stun regains its brackets ----
tasting.freezePlain = true;
E.fireProjectile(Object.assign({ typeId: "frost", upgradePath: null }, { x: t.x, y: t.y, damage: 1, freezeDur: 1, slowDur: 1, slowFactor: 0.6, splash: 0 }), tasting);
E.moveProjectiles(1);   // let the flash orb land
assert(tasting.freezePlain === false, "a real snapshot clears the plain-stun flag (brackets return)");

// ---- Loss Leader t2: a marked death pays bonus Tips ----
t = buildSample(["costcoSaturday", "costcoSaturday"]);
assert(t.lossLeader > 0, "Loss Leader sets the bonus (" + t.lossLeader + " Tips)");
const buyer = makeEnemy({ x: t.x + 40, y: t.y, dist: 50, hp: 1e6, bounty: 9 });
game.enemies.push(buyer);
ticks(1);   // mark it
const cash = game.currency;
E.applyDamage(buyer, 1e9);
assert(game.currency === cash + 9 + t.lossLeader, "a marked death pays bounty + the Loss Leader bonus");

// ---- Bulk Buy t2: marks up to bulkTargets dishes in a small radius ----
t = buildSample(["hardSell", "hardSell"]);
assert(t.bulkTargets > 1 && t.bulkRadius > 0, "Bulk Buy arms multi-marking (" + t.bulkTargets + " in r" + t.bulkRadius + ")");
const c1 = makeEnemy({ x: t.x + 50, y: t.y, dist: 90, hp: 1e6 });        // the sampled dish
const c2 = makeEnemy({ x: t.x + 50 + t.bulkRadius * 0.5, y: t.y, dist: 60, hp: 1e6 });   // clustered
const c3 = makeEnemy({ x: t.x + 50, y: t.y + t.bulkRadius * 0.5, dist: 40, hp: 1e6 });   // clustered
const far = makeEnemy({ x: t.x + 50 + t.bulkRadius * 3, y: t.y, dist: 10, hp: 1e6 });    // outside the radius
game.enemies.push(c1, c2, c3, far);
ticks(1);
assert(c1.ampMul > 1 && c2.ampMul > 1 && c3.ampMul > 1, "the cluster around the sampled dish is all marked");
assert(far.ampMul === 1, "a dish outside the bulk radius is not marked");
assert(t.ampMul > E.TOWER_BY_ID.sample.ampMul, "Hard Sell t1 strengthened the mark over the base value");

done("sample");
