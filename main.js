/*
  Deckbound — main.js
  Issue #3: map & core, game loop.

  What this file does RIGHT NOW:
    - Defines the LEVEL: a single fixed path the enemies will later walk,
      and a CORE (the "Wellspring") at the end of the path that we defend.
    - Draws that path and core onto the canvas.
    - Runs a real GAME LOOP: it updates the world and re-draws it every frame,
      at a steady, stable rate (a "fixed timestep" — explained down below).
    - Shows a tiny debug readout (FPS + elapsed time + update count) so we can
      SEE that the loop is genuinely ticking, and a small glowing dot that
      travels the path as a "the loop is alive" indicator.

  What this file does NOT do yet (on purpose — those are later Issues):
    - No enemies with health (#4), no waves/win (#5), no towers (#6),
      no currency (#7), no cards/deck (#8+). The travelling dot below is only
      a liveness indicator, NOT an enemy — it has no health and can't be shot.

  Why plain canvas (not Phaser) for now: Issue #3 is just a path, a core, and a
  loop. Plain HTML5 canvas keeps this readable and adds no dependencies. We can
  adopt Phaser 3 later if the real-time action needs it (see GAME_BRIEF.md).
*/

/* =========================================================================
   1) CONFIG — sizes and colors, all in one place so they're easy to change.
   ========================================================================= */

// The canvas's internal drawing size (must match width/height in index.html).
// We always draw in this fixed 800x450 "design space"; CSS scales the canvas
// up or down to fit the screen, so the game looks the same on Mac and iPhone.
const VIEW = { w: 800, h: 450 };

// Colors (kept close to the page's dark theme in style.css).
const COLOR = {
  bg: "#10131a", // page-matching background
  grid: "#1b2130", // faint grid lines
  pathEdge: "#2b3346", // dark outer edge of the road
  pathFill: "#3b4a6b", // the walkable road itself
  pathCenter: "#55b3ff", // thin bright center line
  core: "#6ea8fe", // the core / Wellspring
  coreGlow: "#6ea8fe", // pulsing ring around the core
  ink: "#e8ecf3", // bright text
  muted: "#8b94a7", // dim text
  pulse: "#8affc1", // the "loop is alive" travelling dot
};

/* =========================================================================
   2) THE LEVEL — a single fixed path plus the core at its end.
   ------------------------------------------------------------------------
   The path is just a list of points ("waypoints"). Enemies will later walk
   from the first point to the last. The first point sits just off the left
   edge so enemies can march in from off-screen; the last point is the CORE.
   ========================================================================= */

const PATH = [
  { x: -30, y: 110 }, // start: off-screen left (enemies enter here later)
  { x: 170, y: 110 },
  { x: 170, y: 330 },
  { x: 400, y: 330 },
  { x: 400, y: 120 },
  { x: 640, y: 120 },
  { x: 640, y: 300 },
  { x: 748, y: 300 }, // end: the CORE we defend
];

// The core sits on the last waypoint.
const CORE = { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y, radius: 26 };

// How fast the "loop is alive" indicator dot travels, in pixels per second.
const PULSE_SPEED = 150;

/* -------------------------------------------------------------------------
   Path math helpers.
   We pre-compute the length of each segment and the total path length once,
   so we can cheaply ask "where is a point X pixels along the path?". Enemy
   movement in Issue #4 will reuse exactly this helper.
   ------------------------------------------------------------------------- */

// Distance between two points (basic Pythagoras).
function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Length of each straight segment between consecutive waypoints.
const SEGMENT_LENGTHS = PATH.slice(1).map((p, i) => distance(PATH[i], p));

// Total length of the whole path.
const PATH_LENGTH = SEGMENT_LENGTHS.reduce((sum, len) => sum + len, 0);

/**
 * Given a distance travelled from the start of the path, return the {x, y}
 * position at that distance. Distances past the end clamp to the core.
 * @param {number} dist - pixels travelled along the path from the start
 * @returns {{x: number, y: number}}
 */
function pointAtDistance(dist) {
  if (dist <= 0) return { x: PATH[0].x, y: PATH[0].y };

  let remaining = dist;
  for (let i = 0; i < SEGMENT_LENGTHS.length; i++) {
    const segLen = SEGMENT_LENGTHS[i];
    if (remaining <= segLen) {
      // We're inside this segment: blend between its two ends.
      const t = remaining / segLen; // 0 at start of segment, 1 at end
      const a = PATH[i];
      const b = PATH[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segLen;
  }
  // Past the end — clamp to the last point (the core).
  return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
}

/* =========================================================================
   3) GAME STATE — the small bag of numbers the loop updates over time.
   ========================================================================= */

const state = {
  elapsed: 0, // seconds since the loop started
  ticks: 0, // how many fixed updates have run (proves the loop ticks)
  pulseDist: 0, // how far the liveness dot has travelled along the path
  fps: 0, // frames drawn per second (measured, for the debug readout)
};

/* =========================================================================
   4) STARTUP — find the canvas, then start the loop.
   ========================================================================= */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Deckbound: could not find the game canvas.");
    return;
  }

  const ctx = canvas.getContext("2d");
  console.log(
    "Deckbound Issue #3 loaded. Path length:",
    Math.round(PATH_LENGTH),
    "px. Starting game loop…"
  );

  startGameLoop(ctx);
});

/* =========================================================================
   5) THE GAME LOOP — the heartbeat of the game.
   ------------------------------------------------------------------------
   A game loop does two jobs every frame:
     • update(step): move the world forward in time.
     • render():     draw the world as it is right now.

   We use a "fixed timestep": no matter how fast or slow the screen refreshes,
   we always advance the game in equal 1/60-second slices. This keeps movement
   smooth and consistent — the same on a 60Hz Mac and a 120Hz iPhone — and
   stops the game from speeding up or slowing down with the frame rate.
   ========================================================================= */

const STEP = 1 / 60; // seconds of game-time per fixed update (60 updates/sec)

function startGameLoop(ctx) {
  let lastTime; // timestamp of the previous frame (ms)
  let accumulator = 0; // leftover real time waiting to be simulated

  // For measuring FPS: count frames and check the clock once a second.
  let framesThisSecond = 0;
  let fpsTimer = 0;

  function frame(now) {
    // First frame: just record the time and wait for the next one.
    if (lastTime === undefined) lastTime = now;

    // How much real time passed since the last frame, in seconds.
    let dt = (now - lastTime) / 1000;
    lastTime = now;

    // If the tab was backgrounded, dt can be huge; clamp it so we don't try
    // to simulate thousands of steps at once.
    if (dt > 0.25) dt = 0.25;

    // Run as many fixed updates as the elapsed time has "earned".
    accumulator += dt;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }

    // Measure FPS (frames actually drawn per second).
    framesThisSecond++;
    fpsTimer += dt;
    if (fpsTimer >= 1) {
      state.fps = framesThisSecond;
      framesThisSecond = 0;
      fpsTimer -= 1;
    }

    // Draw the current state, then ask the browser for the next frame.
    render(ctx);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

/**
 * Advance the world by one fixed time slice.
 * For now this only moves the clock and the liveness dot; enemies, towers,
 * and waves plug in here in later Issues.
 * @param {number} step - seconds to advance (always STEP)
 */
function update(step) {
  state.elapsed += step;
  state.ticks++;

  // Move the liveness dot along the path, looping back to the start.
  state.pulseDist = (state.pulseDist + PULSE_SPEED * step) % PATH_LENGTH;
}

/* =========================================================================
   6) RENDERING — draw the whole scene, back to front.
   ========================================================================= */

function render(ctx) {
  drawBackground(ctx);
  drawPath(ctx);
  drawCore(ctx);
  drawLivenessDot(ctx);
  drawEntranceLabel(ctx);
  drawDebugReadout(ctx);
}

// Solid background plus a faint grid so distances are readable while building.
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

// The path is drawn as three stacked strokes: a dark edge, the road, and a
// thin bright center line — cheap way to make a flat line read as a "road".
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

// The core we defend: a glowing hexagon with a gently pulsing ring so it feels
// alive. The pulse is driven by state.elapsed, which proves the loop is running.
function drawCore(ctx) {
  const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 2); // 0..1, smooth

  // Pulsing outer ring.
  ctx.strokeStyle = COLOR.coreGlow;
  ctx.globalAlpha = 0.15 + 0.25 * pulse;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, CORE.radius + 8 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Solid hexagon body.
  ctx.fillStyle = COLOR.core;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = CORE.x + Math.cos(angle) * CORE.radius;
    const py = CORE.y + Math.sin(angle) * CORE.radius;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Label under the core.
  ctx.fillStyle = COLOR.ink;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CORE", CORE.x, CORE.y + CORE.radius + 18);
}

// The travelling "loop is alive" dot. Temporary — removed once real enemies
// exist. It doubles as a visual check that the path geometry is correct.
function drawLivenessDot(ctx) {
  const p = pointAtDistance(state.pulseDist);

  ctx.fillStyle = COLOR.pulse;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); // soft halo
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); // solid core of the dot
  ctx.fill();
}

// A small hint at the path entrance so it's obvious where enemies will come in.
function drawEntranceLabel(ctx) {
  ctx.fillStyle = COLOR.muted;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("enemies enter →", 6, 96);
}

// A tiny debug readout in the top-left. Its whole purpose is to make the
// running game loop visible: FPS, elapsed seconds, and the update count.
function drawDebugReadout(ctx) {
  const lines = [
    "Deckbound — Issue #3: map, core & game loop",
    `fps ${state.fps}   time ${state.elapsed.toFixed(1)}s   updates ${state.ticks}`,
  ];

  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Faint backing box so the text stays readable over the grid.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(6, 6, 340, 34);

  ctx.fillStyle = COLOR.ink;
  ctx.fillText(lines[0], 12, 10);
  ctx.fillStyle = COLOR.muted;
  ctx.fillText(lines[1], 12, 25);

  ctx.textBaseline = "alphabetic"; // reset for other draws next frame
}
