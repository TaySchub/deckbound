/*
  Deckbound — main.js
  Task 1: the project skeleton.

  What this file does RIGHT NOW:
    - Finds the <canvas> on the page.
    - Draws a simple placeholder (a border and some centered text) so we can
      SEE that our JavaScript is wired up and drawing correctly.

  What this file does NOT do yet (on purpose):
    - No map, no path, no enemies, no towers, no cards, no game loop logic.
    Those arrive in later tasks. Keeping this tiny makes the first version
    easy to review and hard to break.
*/

// Wait until the whole page is ready, then run our setup once.
window.addEventListener("DOMContentLoaded", () => {
  // 1) Grab the canvas element from the HTML by its id.
  const canvas = document.getElementById("game-canvas");
  if (!canvas) {
    console.error("Deckbound: could not find the game canvas.");
    return;
  }

  // 2) Get the "2D drawing context" — the toolbox we use to draw shapes/text.
  const ctx = canvas.getContext("2d");

  // The canvas's internal drawing size (set in index.html: 800 x 450).
  const W = canvas.width;
  const H = canvas.height;

  // 3) Draw the placeholder scene.
  drawPlaceholder(ctx, W, H);

  // A friendly note in the browser's developer console to confirm it loaded.
  console.log("Deckbound skeleton loaded. Canvas size:", W + "x" + H);
});

/**
 * Draws a simple placeholder onto the canvas.
 * This is only here so the skeleton shows something on screen.
 *
 * @param {CanvasRenderingContext2D} ctx - the drawing toolbox
 * @param {number} w - canvas width in pixels
 * @param {number} h - canvas height in pixels
 */
function drawPlaceholder(ctx, w, h) {
  // Fill the background.
  ctx.fillStyle = "#171b24";
  ctx.fillRect(0, 0, w, h);

  // A soft inner frame so the play area is visible.
  ctx.strokeStyle = "#2a3040";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // Centered title text.
  ctx.fillStyle = "#e8ecf3";
  ctx.textAlign = "center";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("Deckbound", w / 2, h / 2 - 10);

  // A smaller line reminding us this is just the placeholder.
  ctx.fillStyle = "#8b94a7";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText("game canvas placeholder — no game logic yet", w / 2, h / 2 + 24);
}
