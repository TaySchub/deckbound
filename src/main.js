/*
  Deckbound — src/main.js
  The shell: boot, input, the fixed-timestep loop, and the FX wiring that
  connects the DOM-free engine to audio + UI effects. This is the only file
  that touches the DOM. Load order (index.html): balance.data.js -> data.js ->
  engine.js -> audio.js -> art.js -> render.js -> this file.
*/

/* =========================================================================
   6) STARTUP + INPUT
   ========================================================================= */

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) { console.error("Deckbound: could not find the game canvas."); return; }
  game.canvas = canvas;
  game.ctx = canvas.getContext("2d");
  META = loadMeta();
  game.phase = "menu";
  setupInput(canvas);
  console.log("Deckbound v1 loaded. Essence:", META.essence);
  startGameLoop();
});

function setupInput(canvas) {
  const toDesign = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * VIEW.w, y: ((clientY - r.top) / r.height) * VIEW.h };
  };

  const onDown = (clientX, clientY) => {
    audio.unlock();
    const p = toDesign(clientX, clientY);

    // Mute (always available).
    if (p.x >= VIEW.w - 44 && p.x <= VIEW.w - 12 && p.y >= 12 && p.y <= 44) { audio.muted = !audio.muted; return; }

    // Hub / menu.
    if (game.phase === "menu") {
      for (const b of shopButtonRects()) {
        if (inRect(p, b.rect)) { tryBuyShop(b.item); return; }
      }
      if (inRect(p, MODE_BTN)) { chosenEndless = !chosenEndless; audio.build(); return; }
      if (inRect(p, PLAY_BTN)) { startRun(); return; }
      return;
    }

    // Run summary → back to hub.
    if (game.phase === "won" || game.phase === "lost") {
      if (inRect(p, CONTINUE_BTN)) { game.phase = "menu"; }
      return;
    }

    // Selected-tower panel (targeting + upgrade) — check its buttons first so a
    // click on the panel doesn't fall through to the slot/tower underneath it.
    if (game.selectedTower) {
      const panel = towerPanel(game.selectedTower);
      if (inRect(p, panel.rect)) {
        for (const b of panel.modes) if (inRect(p, b.rect)) { game.selectedTower.targeting = b.mode; audio.build(); return; }
        if (inRect(p, panel.upgrade.rect)) { tryUpgrade(game.selectedTower); return; }
        return; // clicked panel background — swallow the click
      }
    }

    // Toolbar: select a card from your deck.
    const deck = deckTypes();
    for (let i = 0; i < deck.length; i++) {
      if (inRect(p, cardRect(i))) { game.selectedType = deck[i].id; return; }
    }

    if (game.phase === "prep" && inRect(p, START_BTN)) { startNextWave(); return; }

    // Click a placed tower → select it (opens the targeting/upgrade panel).
    for (const t of game.towers) if (distance(p, t) <= 18) { game.selectedTower = t; return; }

    // Click an empty slot → build there.
    for (let i = 0; i < SLOTS.length; i++) {
      const s = SLOTS[i];
      if (distance(p, s) <= 20 && !game.towers.some((t) => t.slotIndex === i)) { tryBuild(i); game.selectedTower = null; return; }
    }

    // Clicked empty space → close any open panel.
    game.selectedTower = null;
  };

  canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
  canvas.addEventListener("touchstart", (e) => { if (e.touches[0]) { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
  canvas.addEventListener("mousemove", (e) => { game.pointer = toDesign(e.clientX, e.clientY); });
}

/* =========================================================================
   8) GAME LOOP
   ========================================================================= */

const STEP = 1 / 60;
function startGameLoop() {
  let lastTime, accumulator = 0, framesThisSecond = 0, fpsTimer = 0;
  function frame(now) {
    if (lastTime === undefined) lastTime = now;
    let dt = (now - lastTime) / 1000; lastTime = now;
    if (dt > 0.25) dt = 0.25;
    accumulator += dt;
    while (accumulator >= STEP) { update(STEP); accumulator -= STEP; }
    framesThisSecond++; fpsTimer += dt;
    if (fpsTimer >= 1) { game.fps = framesThisSecond; framesThisSecond = 0; fpsTimer -= 1; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}


/* =========================================================================
   FX WIRING — connect the engine's no-op hooks to real audio + UI effects.
   Headless runs (tools/sim.mjs) skip this file, so the engine stays silent.
   ========================================================================= */

for (const k of ["shoot", "hit", "kill", "leak", "upgrade", "build", "deny", "waveStart", "buy", "win", "lose"]) {
  FX[k] = (...args) => audio[k](...args);
}
// The call-early reward popup is anchored to the Start button (UI geometry the
// engine deliberately doesn't know about).
FX.calledEarly = (bonus) => spawnFloatText(START_BTN.x + START_BTN.w / 2, START_BTN.y - 4, "+" + bonus, COLOR.gold);
