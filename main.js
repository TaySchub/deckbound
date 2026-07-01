/*
  Deckbound — main.js
  Core loop (Stage 1 of finishing the build).

  This turns the earlier feel-prototype into a REAL, playable round:
    - You BUILD towers on fixed slots and UPGRADE them, spending CURRENCY.
    - You survive escalating WAVES. Between waves is a calm prep phase; you can
      also build/upgrade live during a wave (the game's "interactive" pacing).
    - Enemies that reach the CORE cost you LIVES. Lose all lives → you lose.
      Survive all waves → you win.

  Reused from before: the fixed path + core, the fixed-timestep game loop, the
  kill/upgrade particle "juice", and the procedural Web Audio sounds.

  Still to come in later stages: tower variety (#10), enemy variety (#11),
  branching upgrades (#12), deck/hand (#8), meta-progression (#13), polish (#14).
  Still plain canvas — no dependencies.
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
  gold: "#ffe08a",
  good: "#7dff9b",
  bad: "#ff6b6b",
  enemy: "#c86bff",
  enemyEdge: "#e4c2ff",
  projectile: "#8affc1",
  slot: "#4a5670",
  towerByLevel: ["#5c86c8", "#6ea8fe", "#8fd0ff"],
  towerGlowByLevel: ["#3f6bb0", "#6ea8fe", "#c9ecff"],
  upgradeSpark: "#ffe08a",
};

// Economy / rules — all the tunable numbers in one place.
const RULES = {
  startCurrency: 180,
  startLives: 20,
  towerCost: 60,
  upgradeCost: [0, 50, 80], // cost to reach level 2, then level 3 (index by current level)
  earnPerKill: 6,
  earnPerWave: 45,
};

/* =========================================================================
   2) THE LEVEL — path, core, buildable tower slots.
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

// Fixed slots where the player may build a tower (per GAME_BRIEF: "single fixed
// path with tower slots for the first version"). Chosen to cover the path.
const SLOTS = [
  { x: 300, y: 250 },
  { x: 520, y: 210 },
  { x: 110, y: 250 },
  { x: 300, y: 65 },
  { x: 700, y: 205 },
  { x: 285, y: 400 },
];

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

const SEGMENT_LENGTHS = PATH.slice(1).map((p, i) => distance(PATH[i], p));
const PATH_LENGTH = SEGMENT_LENGTHS.reduce((sum, len) => sum + len, 0);

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
   3) WAVES — 10 escalating waves ending in a clear win.
   ------------------------------------------------------------------------
   Each wave: how many enemies, their hp/speed, and the gap between spawns.
   ========================================================================= */

const WAVES = [
  { count: 6, hp: 70, speed: 52, interval: 1.1 },
  { count: 8, hp: 90, speed: 54, interval: 1.0 },
  { count: 10, hp: 115, speed: 56, interval: 0.95 },
  { count: 12, hp: 140, speed: 58, interval: 0.9 },
  { count: 14, hp: 170, speed: 60, interval: 0.85 },
  { count: 16, hp: 205, speed: 62, interval: 0.8 },
  { count: 18, hp: 245, speed: 64, interval: 0.75 },
  { count: 20, hp: 290, speed: 66, interval: 0.7 },
  { count: 22, hp: 345, speed: 70, interval: 0.65 },
  { count: 26, hp: 420, speed: 74, interval: 0.6 },
];

/* =========================================================================
   4) AUDIO — procedural Web Audio (original, license-clean, no files).
   ========================================================================= */

const audio = {
  ctx: null,
  ready: false,
  muted: false,
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ready = true;
    } catch (e) {
      console.warn("Deckbound: audio unavailable —", e);
    }
  },
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
  shoot() { this.tone(520, 0.07, "square", 0.05, 380); },
  hit() { this.tone(240, 0.05, "triangle", 0.04); },
  kill() {
    const start = 600 + Math.random() * 500;
    this.tone(start, 0.18, "sawtooth", 0.16, 90);
    this.noiseBurst(0.16, 0.2);
  },
  upgrade() {
    this.tone(440, 0.1, "triangle", 0.18);
    setTimeout(() => this.tone(660, 0.1, "triangle", 0.18), 70);
    setTimeout(() => this.tone(880, 0.14, "triangle", 0.2), 140);
  },
  build() { this.tone(300, 0.09, "sine", 0.16, 460); },
  deny() { this.tone(180, 0.12, "sawtooth", 0.12, 120); }, // "can't afford" buzz
  waveStart() { this.tone(330, 0.16, "triangle", 0.16, 500); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "triangle", 0.2), i * 130)); },
  lose() { [400, 300, 220, 150].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "sawtooth", 0.18), i * 150)); },
};

/* =========================================================================
   5) GAME STATE
   ========================================================================= */

// phase: "prep" (build/upgrade, press Start) | "wave" (enemies marching) |
//        "won" | "lost"
const game = {
  canvas: null,
  ctx: null,
  phase: "prep",

  currency: RULES.startCurrency,
  lives: RULES.startLives,
  waveIndex: 0, // 0-based; wave number shown is +1

  towers: [], // one per built slot: { slotIndex, x, y, level, ... }
  enemies: [],
  projectiles: [],
  particles: [],

  // Wave-in-progress tracking:
  toSpawn: 0, // enemies left to spawn this wave
  spawnTimer: 0,
  waveHp: 0,
  waveSpeed: 0,

  killed: 0,
  coreHurtFlash: 0,
  elapsed: 0,
  fps: 0,

  pointer: { x: -1, y: -1 },
  message: "", // transient banner text (e.g. "Wave cleared! +45")
  messageTimer: 0,
};

// On-canvas "Start Wave" button rectangle (also reused as "Play again").
const BUTTON = { x: VIEW.w / 2 - 80, y: VIEW.h - 52, w: 160, h: 34 };

function resetGame() {
  game.phase = "prep";
  game.currency = RULES.startCurrency;
  game.lives = RULES.startLives;
  game.waveIndex = 0;
  game.towers = [];
  game.enemies = [];
  game.projectiles = [];
  game.particles = [];
  game.toSpawn = 0;
  game.spawnTimer = 0;
  game.killed = 0;
  game.coreHurtFlash = 0;
  setMessage("Build towers, then press Start Wave");
}

function setMessage(text, seconds = 3) {
  game.message = text;
  game.messageTimer = seconds;
}

/* =========================================================================
   6) STARTUP + INPUT
   ========================================================================= */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Deckbound: could not find the game canvas.");
    return;
  }
  game.canvas = canvas;
  game.ctx = canvas.getContext("2d");
  resetGame();
  setupInput(canvas);
  console.log("Deckbound core loop loaded.");
  startGameLoop();
});

function setupInput(canvas) {
  const toDesign = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * VIEW.w,
      y: ((clientY - r.top) / r.height) * VIEW.h,
    };
  };

  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  const onDown = (clientX, clientY) => {
    audio.unlock();
    const p = toDesign(clientX, clientY);

    // Mute button (top-right).
    if (p.x >= VIEW.w - 44 && p.x <= VIEW.w - 12 && p.y >= 12 && p.y <= 44) {
      audio.muted = !audio.muted;
      return;
    }

    // Game over: the button becomes "Play again".
    if (game.phase === "won" || game.phase === "lost") {
      if (inRect(p, BUTTON)) resetGame();
      return;
    }

    // Start Wave button (only during prep).
    if (game.phase === "prep" && inRect(p, BUTTON)) {
      startNextWave();
      return;
    }

    // Click an existing tower → upgrade it (costs currency).
    for (const t of game.towers) {
      if (distance(p, t) <= 18) {
        tryUpgrade(t);
        return;
      }
    }

    // Click an empty slot → build a tower there (costs currency).
    for (let i = 0; i < SLOTS.length; i++) {
      const s = SLOTS[i];
      if (distance(p, s) <= 20 && !game.towers.some((t) => t.slotIndex === i)) {
        tryBuild(i);
        return;
      }
    }
  };

  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches[0]) {
        e.preventDefault();
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );
  canvas.addEventListener("mousemove", (e) => {
    game.pointer = toDesign(e.clientX, e.clientY);
  });
}

/* =========================================================================
   7) PLAYER ACTIONS — build, upgrade, start wave.
   ========================================================================= */

function tryBuild(slotIndex) {
  if (game.currency < RULES.towerCost) {
    audio.deny();
    setMessage("Not enough currency to build (need " + RULES.towerCost + ")");
    return;
  }
  game.currency -= RULES.towerCost;
  const s = SLOTS[slotIndex];
  game.towers.push({
    slotIndex,
    x: s.x,
    y: s.y,
    level: 1,
    maxLevel: 3,
    range: 130,
    damage: 32,
    cooldown: 0.8,
    cdTimer: 0,
    upgradeFlash: 0,
  });
  spawnRing(s.x, s.y, COLOR.core, 34, 0.4);
  audio.build();
}

function tryUpgrade(t) {
  if (t.level >= t.maxLevel) {
    audio.deny();
    setMessage("Tower is already max level");
    return;
  }
  const cost = RULES.upgradeCost[t.level]; // cost to go from current level to next
  if (game.currency < cost) {
    audio.deny();
    setMessage("Not enough currency to upgrade (need " + cost + ")");
    return;
  }
  game.currency -= cost;
  t.level++;
  t.damage += 18;
  t.range += 15;
  t.cooldown *= 0.85;
  t.upgradeFlash = 0.6;
  spawnUpgradeSparkles(t);
  audio.upgrade();
}

function startNextWave() {
  if (game.phase !== "prep") return;
  const w = WAVES[game.waveIndex];
  game.phase = "wave";
  game.toSpawn = w.count;
  game.spawnTimer = 0;
  game.waveHp = w.hp;
  game.waveSpeed = w.speed;
  game.waveInterval = w.interval;
  setMessage("Wave " + (game.waveIndex + 1) + " incoming!");
  audio.waveStart();
}

/* =========================================================================
   8) GAME LOOP — fixed timestep.
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
   9) UPDATE
   ========================================================================= */

function update(step) {
  game.elapsed += step;
  if (game.coreHurtFlash > 0) game.coreHurtFlash -= step;
  if (game.messageTimer > 0) game.messageTimer -= step;

  // Towers fire and particles animate in every phase (so kills mid-wave feel live).
  updateTowers(step);
  moveProjectiles(step);
  updateParticles(step);

  if (game.phase === "wave") {
    spawnWaveEnemies(step);
    moveEnemies(step);
    checkWaveEnd();
    checkLoss();
  }
}

function spawnWaveEnemies(step) {
  if (game.toSpawn <= 0) return;
  game.spawnTimer -= step;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = game.waveInterval;
    game.toSpawn--;
    game.enemies.push({
      dist: 0,
      speed: game.waveSpeed,
      hp: game.waveHp,
      maxHp: game.waveHp,
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
    if (e.dist >= PATH_LENGTH) {
      e.reachedCore = true;
      game.lives = Math.max(0, game.lives - 1);
      game.coreHurtFlash = 0.35;
    }
  }
  game.enemies = game.enemies.filter((e) => !e.reachedCore);
}

function updateTowers(step) {
  for (const t of game.towers) {
    if (t.upgradeFlash > 0) t.upgradeFlash -= step;
    t.cdTimer -= step;
    if (t.cdTimer > 0) continue;
    let target = null;
    let bestDist = -1;
    for (const e of game.enemies) {
      if (distance(t, e) <= t.range && e.dist > bestDist) {
        target = e;
        bestDist = e.dist;
      }
    }
    if (target) {
      game.projectiles.push({ x: t.x, y: t.y, target, speed: 340, damage: t.damage, radius: 4 });
      audio.shoot();
      t.cdTimer = t.cooldown;
    }
  }
}

function moveProjectiles(step) {
  for (const p of game.projectiles) {
    if (!p.target || !game.enemies.includes(p.target)) {
      p.dead = true;
      continue;
    }
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const stepDist = p.speed * step;
    if (d <= stepDist + p.target.radius) {
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
    game.enemies = game.enemies.filter((e) => e !== enemy);
    game.killed++;
    game.currency += RULES.earnPerKill;
    spawnKillBurst(enemy.x, enemy.y);
    audio.kill();
  } else {
    audio.hit();
  }
}

// A wave ends when everything has spawned AND no enemies remain.
function checkWaveEnd() {
  if (game.phase !== "wave") return;
  if (game.toSpawn <= 0 && game.enemies.length === 0) {
    game.currency += RULES.earnPerWave;
    if (game.waveIndex + 1 >= WAVES.length) {
      game.phase = "won";
      setMessage("You survived all waves — you win!", 999);
      audio.win();
    } else {
      game.waveIndex++;
      game.phase = "prep";
      setMessage("Wave cleared!  +" + RULES.earnPerWave + " — build up, then Start Wave", 4);
    }
  }
}

function checkLoss() {
  if (game.lives <= 0 && game.phase === "wave") {
    game.phase = "lost";
    setMessage("The core has fallen — game over", 999);
    audio.lose();
  }
}

/* -------------------------------------------------------------------------
   Particles
   ------------------------------------------------------------------------- */

function spawnRing(x, y, color, maxR, life) {
  game.particles.push({ type: "ring", x, y, r: 4, maxR, life, maxLife: life, color });
}

function spawnKillBurst(x, y) {
  spawnRing(x, y, COLOR.enemy, 30, 0.35);
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120;
    game.particles.push({
      type: "spark", x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 2,
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
      color: Math.random() < 0.5 ? COLOR.enemy : COLOR.enemyEdge,
    });
  }
}

function spawnUpgradeSparkles(t) {
  spawnRing(t.x, t.y, COLOR.upgradeSpark, 42, 0.5);
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    const sp = 70 + Math.random() * 60;
    game.particles.push({
      type: "spark", x: t.x, y: t.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 2 + Math.random() * 2,
      life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
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
      p.vx *= 0.92;
      p.vy *= 0.92;
    } else if (p.type === "ring") {
      const k = 1 - p.life / p.maxLife;
      p.r = 4 + (p.maxR - 4) * k;
    }
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

/* =========================================================================
   10) RENDER
   ========================================================================= */

function render() {
  const ctx = game.ctx;
  drawBackground(ctx);
  drawPath(ctx);
  drawSlots(ctx);
  drawTowerRanges(ctx);
  drawCore(ctx);
  drawEnemies(ctx);
  drawProjectiles(ctx);
  drawTowers(ctx);
  drawParticles(ctx);
  drawHUD(ctx);
  drawButton(ctx);
  drawMessage(ctx);
  drawMuteButton(ctx);
  if (game.phase === "won" || game.phase === "lost") drawGameOver(ctx);
}

function drawBackground(ctx) {
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  const gap = 50;
  ctx.beginPath();
  for (let x = gap; x < VIEW.w; x += gap) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.h); }
  for (let y = gap; y < VIEW.h; y += gap) { ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); }
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
  ctx.strokeStyle = COLOR.pathEdge; ctx.lineWidth = 44; trace(); ctx.stroke();
  ctx.strokeStyle = COLOR.pathFill; ctx.lineWidth = 34; trace(); ctx.stroke();
  ctx.strokeStyle = COLOR.pathCenter; ctx.globalAlpha = 0.35; ctx.lineWidth = 3; trace(); ctx.stroke();
  ctx.globalAlpha = 1;
}

// Empty build slots: dashed rings with a cost hint (brightest during prep).
function drawSlots(ctx) {
  const canBuild = game.phase === "prep" || game.phase === "wave";
  for (let i = 0; i < SLOTS.length; i++) {
    if (game.towers.some((t) => t.slotIndex === i)) continue;
    const s = SLOTS[i];
    const hover = distance(game.pointer, s) <= 20;
    const affordable = game.currency >= RULES.towerCost;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = hover ? (affordable ? COLOR.good : COLOR.bad) : COLOR.slot;
    ctx.globalAlpha = canBuild ? (hover ? 0.9 : 0.5) : 0.25;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (hover && canBuild) {
      ctx.fillStyle = affordable ? COLOR.good : COLOR.bad;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("build " + RULES.towerCost, s.x, s.y - 22);
    }
  }
}

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
    ctx.fillStyle = e.hurtFlash > 0 ? "#ffffff" : COLOR.enemy;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLOR.enemyEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (e.hp < e.maxHp) {
      const w = 26;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 4);
      ctx.fillStyle = COLOR.good;
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
    const body = COLOR.towerByLevel[idx] || COLOR.towerByLevel[2];
    const glow = COLOR.towerGlowByLevel[idx] || body;
    const radius = 14 + idx * 2;
    const glowStrength = 0.12 + idx * 0.12 + Math.max(0, t.upgradeFlash);
    ctx.globalAlpha = Math.min(0.6, glowStrength);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - radius);
    ctx.lineTo(t.x + radius, t.y);
    ctx.lineTo(t.x, t.y + radius);
    ctx.lineTo(t.x - radius, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#eaf2ff";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < t.maxLevel; i++) {
      ctx.beginPath();
      ctx.arc(t.x - 8 + i * 8, t.y - radius - 10, 3, 0, Math.PI * 2);
      ctx.fillStyle = i < t.level ? COLOR.upgradeSpark : "#39404f";
      ctx.fill();
    }
    // Upgrade-cost hint when hovering a non-max tower.
    if (distance(game.pointer, t) <= 18 && t.level < t.maxLevel) {
      ctx.fillStyle = game.currency >= RULES.upgradeCost[t.level] ? COLOR.good : COLOR.bad;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("upgrade " + RULES.upgradeCost[t.level], t.x, t.y - radius - 18);
    }
  }
}

function drawParticles(ctx) {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
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

function drawHUD(ctx) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(6, 6, 316, 26);
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillStyle = COLOR.bad;
  ctx.fillText("♥ " + game.lives, 14, 11);
  ctx.fillStyle = COLOR.gold;
  ctx.fillText("◆ " + game.currency, 70, 11);
  ctx.fillStyle = COLOR.ink;
  ctx.fillText("Wave " + Math.min(game.waveIndex + 1, WAVES.length) + "/" + WAVES.length, 150, 11);
  ctx.fillStyle = COLOR.muted;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(game.phase === "wave" ? "defending…" : "prep", 250, 12);
  ctx.textBaseline = "alphabetic";
}

function drawButton(ctx) {
  if (game.phase !== "prep") return;
  const hover = inButton(game.pointer);
  ctx.fillStyle = hover ? COLOR.core : "#2b3f66";
  roundRect(ctx, BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h, 8);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("▶  Start Wave " + (game.waveIndex + 1), VIEW.w / 2, BUTTON.y + BUTTON.h / 2);
  ctx.textBaseline = "alphabetic";
}

function drawMessage(ctx) {
  if (game.messageTimer <= 0 || game.phase === "won" || game.phase === "lost") return;
  ctx.globalAlpha = Math.min(1, game.messageTimer);
  ctx.fillStyle = COLOR.ink;
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(game.message, VIEW.w / 2, 60);
  ctx.globalAlpha = 1;
}

function drawGameOver(ctx) {
  ctx.fillStyle = "rgba(8,10,15,0.78)";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = "center";
  ctx.fillStyle = game.phase === "won" ? COLOR.good : COLOR.bad;
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText(game.phase === "won" ? "VICTORY" : "DEFEAT", VIEW.w / 2, VIEW.h / 2 - 24);
  ctx.fillStyle = COLOR.ink;
  ctx.font = "15px system-ui, sans-serif";
  const detail =
    game.phase === "won"
      ? "You survived all " + WAVES.length + " waves. Enemies destroyed: " + game.killed
      : "Reached wave " + (game.waveIndex + 1) + ". Enemies destroyed: " + game.killed;
  ctx.fillText(detail, VIEW.w / 2, VIEW.h / 2 + 6);
  // Play again button.
  const hover = inButton(game.pointer);
  ctx.fillStyle = hover ? COLOR.core : "#2b3f66";
  roundRect(ctx, BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h, 8);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("↻  Play again", VIEW.w / 2, BUTTON.y + BUTTON.h / 2);
  ctx.textBaseline = "alphabetic";
}

function drawMuteButton(ctx) {
  const x = VIEW.w - 44, y = 12;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x, y, 32, 32);
  ctx.fillStyle = audio.muted ? COLOR.muted : COLOR.core;
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
    ctx.strokeStyle = COLOR.coreHurt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 11); ctx.lineTo(x + 28, y + 21);
    ctx.moveTo(x + 28, y + 11); ctx.lineTo(x + 22, y + 21);
    ctx.stroke();
  } else {
    ctx.strokeStyle = COLOR.core;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 21, y + 16, 4, -0.6, 0.6);
    ctx.arc(x + 21, y + 16, 8, -0.6, 0.6);
    ctx.stroke();
  }
}

/* -------------------------------------------------------------------------
   Small drawing helpers
   ------------------------------------------------------------------------- */

function inButton(p) {
  return p.x >= BUTTON.x && p.x <= BUTTON.x + BUTTON.w && p.y >= BUTTON.y && p.y <= BUTTON.y + BUTTON.h;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
