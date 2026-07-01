/*
  Deckbound — main.js
  Combat feel-prototype (built on Issue #3's path + core + game loop).

  GOAL of this prototype: make two developer ideas real and playable —
    (2) upgrades that look GOOD, and
    (3) cool, UNIQUE sounds when towers take out enemies.

  So this slice fast-forwards a little past the strict roadmap to show the
  *feel*: enemies walk the fixed path, two pre-placed towers auto-fire and
  destroy them with satisfying visual pops + sounds, and CLICKING a tower
  upgrades it with a visible glow-up + an upgrade sound.

  Deliberately NOT here yet (these get built properly, in order, afterward):
    - Placing towers yourself / a placement grid (#6)
    - Currency to pay for placing & upgrading (#7)
    - Waves, win/lose screens (#4, #5)
    - Cards / deck / hand (#8+)
  Tower positions, enemy stats, and upgrades are hard-coded here to isolate the
  *feel*. All sounds are generated in-code with the Web Audio API — original and
  license-clean, no audio files.
*/

/* =========================================================================
   1) CONFIG
   ========================================================================= */

const VIEW = { w: 800, h: 450 };

const COLOR = {
  bg: "#10131a",
  grid: "#1b2130",
  pathEdge: "#2b3346",
  pathFill: "#3b4a6b",
  pathCenter: "#55b3ff",
  core: "#6ea8fe",
  coreHurt: "#ff6b6b",
  ink: "#e8ecf3",
  muted: "#8b94a7",
  enemy: "#c86bff", // "blight mote"
  enemyEdge: "#e4c2ff",
  projectile: "#8affc1",
  // Tower body color per upgrade level (1..3) — the visible "glow-up".
  towerByLevel: ["#5c86c8", "#6ea8fe", "#8fd0ff"],
  towerGlowByLevel: ["#3f6bb0", "#6ea8fe", "#c9ecff"],
  upgradeSpark: "#ffe08a",
};

/* =========================================================================
   2) THE LEVEL — path + core (from Issue #3), plus the path helper.
   ========================================================================= */

const PATH = [
  { x: -30, y: 110 },
  { x: 170, y: 110 },
  { x: 170, y: 330 },
  { x: 400, y: 330 },
  { x: 400, y: 120 },
  { x: 640, y: 120 },
  { x: 640, y: 300 },
  { x: 748, y: 300 },
];

const CORE = { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y, radius: 26 };

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const SEGMENT_LENGTHS = PATH.slice(1).map((p, i) => distance(PATH[i], p));
const PATH_LENGTH = SEGMENT_LENGTHS.reduce((sum, len) => sum + len, 0);

// Position at a distance travelled along the path (reused for enemy movement).
function pointAtDistance(dist) {
  if (dist <= 0) return { x: PATH[0].x, y: PATH[0].y };
  let remaining = dist;
  for (let i = 0; i < SEGMENT_LENGTHS.length; i++) {
    const segLen = SEGMENT_LENGTHS[i];
    if (remaining <= segLen) {
      const t = remaining / segLen;
      const a = PATH[i];
      const b = PATH[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segLen;
  }
  return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
}

/* =========================================================================
   3) AUDIO — tiny procedural sound engine (Web Audio API).
   ------------------------------------------------------------------------
   No sound files: every effect is synthesized from oscillators + noise, so
   it's original and license-clean. Browsers block audio until the user
   interacts, so we create the audio context on the first click/tap.
   ========================================================================= */

const audio = {
  ctx: null,
  ready: false,
  muted: false,

  // Called on the first user gesture (click/tap) to unlock audio.
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return; // browser has no Web Audio — game still works, just silent
      this.ctx = new AC();
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ready = true;
    } catch (e) {
      // Never let audio break the game.
      console.warn("Deckbound: audio unavailable —", e);
    }
  },

  // A short tone with a quick fade, optionally sliding in pitch.
  tone(freq, dur, type = "sine", gain = 0.2, freqTo = null) {
    if (!this.ready || this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqTo != null) osc.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  },

  // A short burst of filtered noise (for the "pop" on a kill).
  noiseBurst(dur, gain = 0.25) {
    if (!this.ready || this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g).connect(this.ctx.destination);
    src.start(t0);
  },

  // --- Named effects ---
  shoot() {
    this.tone(520, 0.07, "square", 0.06, 380); // quick blip
  },
  hit() {
    this.tone(240, 0.05, "triangle", 0.05); // soft tick
  },
  kill() {
    // "Cool & unique": each kill is a little different — random descending zap
    // plus a noise pop, so it never sounds monotonous.
    const start = 600 + Math.random() * 500;
    this.tone(start, 0.18, "sawtooth", 0.18, 90);
    this.noiseBurst(0.16, 0.22);
  },
  upgrade() {
    // Rising three-note sparkle — reads as "leveled up!".
    this.tone(440, 0.1, "triangle", 0.18);
    setTimeout(() => this.tone(660, 0.1, "triangle", 0.18), 70);
    setTimeout(() => this.tone(880, 0.14, "triangle", 0.2), 140);
  },
};

/* =========================================================================
   4) GAME STATE — the world the loop updates.
   ========================================================================= */

const game = {
  canvas: null,
  ctx: null,

  enemies: [],
  towers: [],
  projectiles: [],
  particles: [],

  spawnTimer: 0,
  spawnEvery: 1.6, // seconds between enemy spawns
  spawnedCount: 0,

  killed: 0, // enemies destroyed (for the readout & the player's satisfaction)
  leaked: 0, // enemies that reached the core
  coreHurtFlash: 0, // >0 briefly after a leak, to flash the core red

  elapsed: 0,
  fps: 0,

  pointer: { x: -1, y: -1 }, // last pointer position in design coords (for hover)
};

// Two hand-placed towers positioned to cover different stretches of the path.
function makeTowers() {
  return [
    makeTower(300, 250),
    makeTower(520, 210),
  ];
}

function makeTower(x, y) {
  return {
    x,
    y,
    level: 1,
    maxLevel: 3,
    // Base stats; upgrades scale these (see upgradeTower).
    range: 135,
    damage: 34,
    cooldown: 0.8, // seconds between shots
    cdTimer: 0,
    radius: 16,
    upgradeFlash: 0, // >0 briefly after an upgrade, for a burst of glow
  };
}

/* =========================================================================
   5) STARTUP
   ========================================================================= */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Deckbound: could not find the game canvas.");
    return;
  }
  game.canvas = canvas;
  game.ctx = canvas.getContext("2d");
  game.towers = makeTowers();

  setupInput(canvas);

  console.log("Deckbound combat feel-prototype loaded. Click a tower to upgrade it.");
  startGameLoop();
});

/* -------------------------------------------------------------------------
   Input: map screen clicks/taps to the fixed 800x450 design space, unlock
   audio on first gesture, and handle tower upgrades + the mute button.
   ------------------------------------------------------------------------- */

function setupInput(canvas) {
  const toDesign = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * VIEW.w,
      y: ((clientY - r.top) / r.height) * VIEW.h,
    };
  };

  const onDown = (clientX, clientY) => {
    audio.unlock(); // first gesture enables sound
    const p = toDesign(clientX, clientY);

    // Mute button (top-right)? Toggle and stop.
    if (p.x >= VIEW.w - 44 && p.x <= VIEW.w - 12 && p.y >= 12 && p.y <= 44) {
      audio.muted = !audio.muted;
      return;
    }

    // Clicked a tower? Upgrade it.
    for (const t of game.towers) {
      if (distance(p, t) <= t.radius + 8) {
        upgradeTower(t);
        return;
      }
    }
  };

  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches[0]) {
        e.preventDefault(); // avoid the browser also firing a delayed click
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );
  // Track hover so we can show a tower's range ring when the mouse is near it.
  canvas.addEventListener("mousemove", (e) => {
    game.pointer = toDesign(e.clientX, e.clientY);
  });
}

function upgradeTower(t) {
  if (t.level >= t.maxLevel) {
    // Already maxed — small confirm blip, no stat change.
    audio.tone(300, 0.08, "sine", 0.08);
    return;
  }
  t.level++;
  t.damage += 18;
  t.range += 15;
  t.cooldown *= 0.85; // fires faster
  t.radius += 2;
  t.upgradeFlash = 0.6; // seconds of extra glow
  spawnUpgradeSparkles(t);
  audio.upgrade();
}

/* =========================================================================
   6) GAME LOOP — fixed timestep (from Issue #3).
   ========================================================================= */

const STEP = 1 / 60;

function startGameLoop() {
  let lastTime;
  let accumulator = 0;
  let framesThisSecond = 0;
  let fpsTimer = 0;

  function frame(now) {
    if (lastTime === undefined) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.25) dt = 0.25;

    accumulator += dt;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }

    framesThisSecond++;
    fpsTimer += dt;
    if (fpsTimer >= 1) {
      game.fps = framesThisSecond;
      framesThisSecond = 0;
      fpsTimer -= 1;
    }

    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* =========================================================================
   7) UPDATE — advance the world one fixed slice.
   ========================================================================= */

function update(step) {
  game.elapsed += step;
  if (game.coreHurtFlash > 0) game.coreHurtFlash -= step;

  spawnEnemies(step);
  moveEnemies(step);
  updateTowers(step);
  moveProjectiles(step);
  updateParticles(step);
}

function spawnEnemies(step) {
  game.spawnTimer -= step;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = game.spawnEvery;
    game.spawnedCount++;
    // Gentle escalation: every few spawns, enemies get a little tougher/faster.
    const tier = Math.floor(game.spawnedCount / 6);
    game.enemies.push({
      dist: 0,
      speed: 55 + tier * 6,
      hp: 100 + tier * 30,
      maxHp: 100 + tier * 30,
      radius: 12,
      hurtFlash: 0,
    });
  }
}

function moveEnemies(step) {
  for (const e of game.enemies) {
    e.dist += e.speed * step;
    const p = pointAtDistance(e.dist);
    e.x = p.x;
    e.y = p.y;
    if (e.hurtFlash > 0) e.hurtFlash -= step;

    // Reached the core?
    if (e.dist >= PATH_LENGTH) {
      e.reachedCore = true;
      game.leaked++;
      game.coreHurtFlash = 0.35;
    }
  }
  // Remove enemies that reached the core.
  game.enemies = game.enemies.filter((e) => !e.reachedCore);
}

function updateTowers(step) {
  for (const t of game.towers) {
    if (t.upgradeFlash > 0) t.upgradeFlash -= step;
    t.cdTimer -= step;
    if (t.cdTimer > 0) continue;

    // Target the enemy that is furthest along the path (closest to the core)
    // and within range — the standard, sensible tower-defense targeting.
    let target = null;
    let bestDist = -1;
    for (const e of game.enemies) {
      if (distance(t, e) <= t.range && e.dist > bestDist) {
        target = e;
        bestDist = e.dist;
      }
    }
    if (target) {
      fireProjectile(t, target);
      t.cdTimer = t.cooldown;
    }
  }
}

function fireProjectile(t, target) {
  game.projectiles.push({
    x: t.x,
    y: t.y,
    target,
    speed: 340,
    damage: t.damage,
    radius: 4,
  });
  audio.shoot();
}

function moveProjectiles(step) {
  for (const p of game.projectiles) {
    // If the target is gone, let the projectile fade by marking it done.
    if (!p.target || !game.enemies.includes(p.target)) {
      p.dead = true;
      continue;
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const stepDist = p.speed * step;

    if (d <= stepDist + p.target.radius) {
      // Hit!
      applyDamage(p.target, p.damage);
      p.dead = true;
    } else {
      p.x += (dx / d) * stepDist;
      p.y += (dy / d) * stepDist;
    }
  }
  game.projectiles = game.projectiles.filter((p) => !p.dead);
}

function applyDamage(enemy, dmg) {
  enemy.hp -= dmg;
  enemy.hurtFlash = 0.08;
  if (enemy.hp <= 0) {
    killEnemy(enemy);
  } else {
    audio.hit();
  }
}

function killEnemy(enemy) {
  enemy.reachedCore = false;
  game.enemies = game.enemies.filter((e) => e !== enemy);
  game.killed++;
  spawnKillBurst(enemy.x, enemy.y);
  audio.kill();
}

/* -------------------------------------------------------------------------
   Particles — the visual "juice" for kills and upgrades.
   ------------------------------------------------------------------------- */

function spawnKillBurst(x, y) {
  // Expanding ring...
  game.particles.push({ type: "ring", x, y, r: 4, maxR: 30, life: 0.35, maxLife: 0.35, color: COLOR.enemy });
  // ...plus a spray of sparks.
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120;
    game.particles.push({
      type: "spark",
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 2,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      color: Math.random() < 0.5 ? COLOR.enemy : COLOR.enemyEdge,
    });
  }
}

function spawnUpgradeSparkles(t) {
  game.particles.push({ type: "ring", x: t.x, y: t.y, r: 6, maxR: 42, life: 0.5, maxLife: 0.5, color: COLOR.upgradeSpark });
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    const sp = 70 + Math.random() * 60;
    game.particles.push({
      type: "spark",
      x: t.x,
      y: t.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 2,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      color: COLOR.upgradeSpark,
    });
  }
}

function updateParticles(step) {
  for (const p of game.particles) {
    p.life -= step;
    if (p.type === "spark") {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vx *= 0.92; // drag, so sparks slow down
      p.vy *= 0.92;
    } else if (p.type === "ring") {
      const k = 1 - p.life / p.maxLife; // 0..1 over its life
      p.r = 4 + (p.maxR - 4) * k;
    }
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

/* =========================================================================
   8) RENDER
   ========================================================================= */

function render() {
  const ctx = game.ctx;
  drawBackground(ctx);
  drawPath(ctx);
  drawTowerRanges(ctx);
  drawCore(ctx);
  drawEnemies(ctx);
  drawProjectiles(ctx);
  drawTowers(ctx);
  drawParticles(ctx);
  drawUI(ctx);
}

function drawBackground(ctx) {
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  const gap = 50;
  ctx.beginPath();
  for (let x = gap; x < VIEW.w; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.h);
  }
  for (let y = gap; y < VIEW.h; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.w, y);
  }
  ctx.stroke();
}

function drawPath(ctx) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  };
  ctx.strokeStyle = COLOR.pathEdge;
  ctx.lineWidth = 44;
  trace();
  ctx.stroke();
  ctx.strokeStyle = COLOR.pathFill;
  ctx.lineWidth = 34;
  trace();
  ctx.stroke();
  ctx.strokeStyle = COLOR.pathCenter;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  trace();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Faint range ring: always shown lightly, brighter when you hover the tower.
function drawTowerRanges(ctx) {
  for (const t of game.towers) {
    const hover = distance(game.pointer, t) <= t.range;
    ctx.strokeStyle = COLOR.core;
    ctx.globalAlpha = hover ? 0.18 : 0.06;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawCore(ctx) {
  const hurt = game.coreHurtFlash > 0;
  const pulse = 0.5 + 0.5 * Math.sin(game.elapsed * 2);
  ctx.strokeStyle = hurt ? COLOR.coreHurt : COLOR.core;
  ctx.globalAlpha = 0.15 + 0.25 * pulse;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, CORE.radius + 8 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = hurt ? COLOR.coreHurt : COLOR.core;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = CORE.x + Math.cos(angle) * CORE.radius;
    const py = CORE.y + Math.sin(angle) * CORE.radius;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLOR.ink;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CORE", CORE.x, CORE.y + CORE.radius + 18);
}

function drawEnemies(ctx) {
  for (const e of game.enemies) {
    // Body (flashes white briefly when hit).
    ctx.fillStyle = e.hurtFlash > 0 ? "#ffffff" : COLOR.enemy;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOR.enemyEdge;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Health bar (only once damaged).
    if (e.hp < e.maxHp) {
      const w = 26;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
      ctx.fillStyle = "#7dff9b";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w * frac, 4);
    }
  }
}

function drawProjectiles(ctx) {
  ctx.fillStyle = COLOR.projectile;
  for (const p of game.projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowers(ctx) {
  for (const t of game.towers) {
    const idx = t.level - 1;
    const body = COLOR.towerByLevel[idx] || COLOR.towerByLevel[COLOR.towerByLevel.length - 1];
    const glow = COLOR.towerGlowByLevel[idx] || body;

    // Glow (stronger at higher levels, and briefly after an upgrade).
    const glowStrength = 0.12 + idx * 0.12 + Math.max(0, t.upgradeFlash);
    ctx.globalAlpha = Math.min(0.6, glowStrength);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body — a rounded diamond that grows with level.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.radius);
    ctx.lineTo(t.x + t.radius, t.y);
    ctx.lineTo(t.x, t.y + t.radius);
    ctx.lineTo(t.x - t.radius, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#eaf2ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Level pips above the tower (●●● as you upgrade).
    for (let i = 0; i < t.maxLevel; i++) {
      ctx.beginPath();
      ctx.arc(t.x - 8 + i * 8, t.y - t.radius - 10, 3, 0, Math.PI * 2);
      ctx.fillStyle = i < t.level ? COLOR.upgradeSpark : "#39404f";
      ctx.fill();
    }
  }
}

function drawParticles(ctx) {
  for (const p of game.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.type === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawUI(ctx) {
  // Top-left readout.
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(6, 6, 360, 34);
  ctx.fillStyle = COLOR.ink;
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText("Deckbound — combat feel-prototype", 12, 10);
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(
    `destroyed ${game.killed}   leaked ${game.leaked}   fps ${game.fps}`,
    12,
    25
  );

  // Hint line at the bottom.
  ctx.fillStyle = COLOR.muted;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const hint = audio.ready
    ? "click a tower to upgrade it"
    : "click a tower to upgrade  •  click anywhere to enable sound";
  ctx.fillText(hint, VIEW.w / 2, VIEW.h - 12);

  // Mute button (top-right): a little speaker that shows on/off.
  drawMuteButton(ctx);
}

function drawMuteButton(ctx) {
  const x = VIEW.w - 44;
  const y = 12;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x, y, 32, 32);
  ctx.fillStyle = audio.muted ? COLOR.muted : COLOR.core;
  // speaker box
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 13);
  ctx.lineTo(x + 14, y + 13);
  ctx.lineTo(x + 19, y + 9);
  ctx.lineTo(x + 19, y + 23);
  ctx.lineTo(x + 14, y + 19);
  ctx.lineTo(x + 9, y + 19);
  ctx.closePath();
  ctx.fill();
  if (audio.muted) {
    // an "x" when muted
    ctx.strokeStyle = COLOR.coreHurt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 11);
    ctx.lineTo(x + 28, y + 21);
    ctx.moveTo(x + 28, y + 11);
    ctx.lineTo(x + 22, y + 21);
    ctx.stroke();
  } else {
    // sound waves when on
    ctx.strokeStyle = COLOR.core;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 21, y + 16, 4, -0.6, 0.6);
    ctx.arc(x + 21, y + 16, 8, -0.6, 0.6);
    ctx.stroke();
  }
}
