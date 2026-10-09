import { $, show, hide } from "./utils.js";

// --- Constants & Config ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 20;

const COLORS = {
  I: "#00f0f0",
  J: "#3377ff",
  L: "#ff9900",
  O: "#ffdd00",
  S: "#22cc44",
  T: "#cc33dd",
  Z: "#ee3333",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const PIECE_TYPES = ["I", "J", "L", "O", "S", "T", "Z"];

// --- Sound Synthesizer ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration = 0.08, type = "square", gainVal = 0.05) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio autoplay restrictions or errors silently ignored
  }
}

function playMoveSound() {
  playTone(220, 0.03, "triangle", 0.03);
}

function playRotateSound() {
  playTone(330, 0.05, "triangle", 0.04);
}

function playDropSound() {
  playTone(180, 0.06, "square", 0.05);
}

function playClearSound(lines) {
  const tones = [440, 554, 659, 880];
  tones.slice(0, lines).forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 0.12, "sine", 0.08), idx * 60);
  });
}

function playGameOverSound() {
  const tones = [300, 260, 220, 180];
  tones.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 0.15, "sawtooth", 0.06), idx * 80);
  });
}

// --- Game State ---
let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let bag = [];
let score = 0;
let lines = 0;
let level = 1;
let gameOver = false;
let isPaused = false;
let animId = null;
let lastDropTime = 0;
let isRunning = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function refillBag() {
  bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}

function getNextPieceType() {
  if (bag.length === 0) refillBag();
  return bag.pop();
}

function createPiece(type) {
  return {
    type,
    color: COLORS[type],
    shape: SHAPES[type].map((row) => [...row]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: 0,
  };
}

// --- Collision & Validation ---
function isValid(piece, offsetX, offsetY, matrix = piece.shape) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const newX = piece.x + c + offsetX;
        const newY = piece.y + r + offsetY;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
        if (newY >= 0 && board[newY][newX]) return false;
      }
    }
  }
  return true;
}

function rotateMatrix(matrix) {
  const N = matrix.length;
  const result = Array.from({ length: N }, () => Array(N).fill(0));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      result[c][N - 1 - r] = matrix[r][c];
    }
  }
  return result;
}

function getGhostY() {
  if (!currentPiece) return 0;
  let ghostY = currentPiece.y;
  while (isValid(currentPiece, 0, ghostY - currentPiece.y + 1)) {
    ghostY++;
  }
  return ghostY;
}

// --- Movement & Actions ---
function moveLeft() {
  if (!isRunning || isPaused || gameOver || !currentPiece) return;
  if (isValid(currentPiece, -1, 0)) {
    currentPiece.x--;
    playMoveSound();
    draw();
  }
}

function moveRight() {
  if (!isRunning || isPaused || gameOver || !currentPiece) return;
  if (isValid(currentPiece, 1, 0)) {
    currentPiece.x++;
    playMoveSound();
    draw();
  }
}

function rotatePiece() {
  if (!isRunning || isPaused || gameOver || !currentPiece) return;
  const rotated = rotateMatrix(currentPiece.shape);

  // Wall kicks: try offset 0, -1, +1, -2, +2
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (isValid(currentPiece, kick, 0, rotated)) {
      currentPiece.shape = rotated;
      currentPiece.x += kick;
      playRotateSound();
      draw();
      return;
    }
  }
}

function softDrop() {
  if (!isRunning || isPaused || gameOver || !currentPiece) return;
  if (isValid(currentPiece, 0, 1)) {
    currentPiece.y++;
    score += 1;
    updateUI();
    draw();
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (!isRunning || isPaused || gameOver || !currentPiece) return;
  let dropDistance = 0;
  while (isValid(currentPiece, 0, 1)) {
    currentPiece.y++;
    dropDistance++;
  }
  score += dropDistance * 2;
  playDropSound();
  updateUI();
  lockPiece();
}

function lockPiece() {
  if (!currentPiece) return;
  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (currentPiece.shape[r][c]) {
        const boardY = currentPiece.y + r;
        const boardX = currentPiece.x + c;
        if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
          board[boardY][boardX] = currentPiece.color;
        }
      }
    }
  }

  clearLines();
  spawnPiece();
  draw();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((cell) => cell !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      r++; // Check same row again
    }
  }

  if (cleared > 0) {
    const linePoints = [0, 100, 300, 500, 800];
    score += (linePoints[cleared] || 800) * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    playClearSound(cleared);
    updateUI();
  }
}

function spawnPiece() {
  currentPiece = nextPiece || createPiece(getNextPieceType());
  nextPiece = createPiece(getNextPieceType());

  if (!isValid(currentPiece, 0, 0)) {
    gameOver = true;
    playGameOverSound();
    showOverlay(
      "GAME OVER",
      "Restart",
      "Press <strong>R</strong> to restart<br>or type <strong>:restart</strong>",
    );
  }

  drawNext();
}

function getDropInterval() {
  return Math.max(120, 800 - (level - 1) * 70);
}

// --- Rendering ---
function drawBlock(ctx, x, y, size, color, isGhost = false) {
  if (isGhost) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  // Beveled 3D highlight (top/left)
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(x, y, size, 2);
  ctx.fillRect(x, y, 2, size);

  // Beveled 3D shadow (bottom/right)
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(x, y + size - 2, size, 2);
  ctx.fillRect(x + size - 2, y, 2, size);
}

function draw() {
  const canvas = $("#tetris-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK_SIZE);
    ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, 0);
    ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
    ctx.stroke();
  }

  // Placed blocks
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawBlock(
          ctx,
          c * BLOCK_SIZE,
          r * BLOCK_SIZE,
          BLOCK_SIZE,
          board[r][c],
        );
      }
    }
  }

  // Ghost piece
  if (currentPiece && !gameOver && !isPaused) {
    const ghostY = getGhostY();
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c]) {
          const drawY = (ghostY + r) * BLOCK_SIZE;
          const drawX = (currentPiece.x + c) * BLOCK_SIZE;
          if (drawY >= 0) {
            drawBlock(ctx, drawX, drawY, BLOCK_SIZE, currentPiece.color, true);
          }
        }
      }
    }
  }

  // Active falling piece
  if (currentPiece && !gameOver) {
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c]) {
          const drawY = (currentPiece.y + r) * BLOCK_SIZE;
          const drawX = (currentPiece.x + c) * BLOCK_SIZE;
          if (drawY >= 0) {
            drawBlock(ctx, drawX, drawY, BLOCK_SIZE, currentPiece.color);
          }
        }
      }
    }
  }
}

function drawNext() {
  const canvas = $("#tetris-next");
  if (!canvas || !nextPiece) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shape = nextPiece.shape;
  const size = 16;
  const shapeWidth = shape[0].length * size;
  const shapeHeight = shape.length * size;
  const startX = Math.floor((canvas.width - shapeWidth) / 2);
  const startY = Math.floor((canvas.height - shapeHeight) / 2);

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        drawBlock(
          ctx,
          startX + c * size,
          startY + r * size,
          size,
          nextPiece.color,
        );
      }
    }
  }
}

function updateUI() {
  const scoreEl = $("#tetris-score");
  const linesEl = $("#tetris-lines");
  const levelEl = $("#tetris-level");
  if (scoreEl) scoreEl.textContent = score.toLocaleString();
  if (linesEl) linesEl.textContent = lines;
  if (levelEl) levelEl.textContent = level;
}

function showOverlay(message, btnText, hintText = "") {
  const overlay = $("#tetris-overlay");
  const msgEl = $("#tetris-overlay-msg");
  const btnEl = $("#tetris-overlay-btn");
  const hintEl = $("#tetris-overlay-hint");
  if (!overlay) return;
  if (msgEl) msgEl.textContent = message;
  if (btnEl) btnEl.textContent = btnText;
  if (hintEl) hintEl.innerHTML = hintText;
  show(overlay);
}

function hideOverlay() {
  const overlay = $("#tetris-overlay");
  if (overlay) hide(overlay);
}

// --- Game Loop ---
function loop(timestamp) {
  if (!isRunning) return;

  if (!isPaused && !gameOver) {
    if (!lastDropTime) lastDropTime = timestamp;
    const interval = getDropInterval();

    if (timestamp - lastDropTime > interval) {
      if (currentPiece) {
        if (isValid(currentPiece, 0, 1)) {
          currentPiece.y++;
          draw();
        } else {
          lockPiece();
        }
      }
      lastDropTime = timestamp;
    }
  }

  animId = requestAnimationFrame(loop);
}

// --- Public Controls ---
export function startTetris() {
  if (!isRunning) {
    isRunning = true;
    if (gameOver) {
      resetTetris();
      return;
    }
    if (!currentPiece) {
      refillBag();
      spawnPiece();
    }
    isPaused = false;
    hideOverlay();
    lastDropTime = performance.now();
    draw();
    drawNext();
    updateUI();
    animId = requestAnimationFrame(loop);
  } else if (isPaused && !gameOver) {
    togglePause();
  }
}

export function pauseTetris() {
  if (isRunning && !isPaused && !gameOver) {
    isPaused = true;
    showOverlay(
      "PAUSED",
      "Resume",
      "Press <strong>P</strong> to resume<br>or type <strong>:pause</strong>",
    );
  }
}

export function togglePause() {
  if (gameOver) {
    resetTetris();
    return;
  }
  isPaused = !isPaused;
  if (isPaused) {
    showOverlay(
      "PAUSED",
      "Resume",
      "Press <strong>P</strong> to resume<br>or type <strong>:pause</strong>",
    );
  } else {
    hideOverlay();
    lastDropTime = performance.now();
  }
}

export function resetTetris() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  isPaused = false;
  currentPiece = null;
  nextPiece = null;
  bag = [];

  hideOverlay();

  refillBag();
  spawnPiece();
  updateUI();
  draw();
  drawNext();

  if (!isRunning) {
    isRunning = true;
    lastDropTime = performance.now();
    animId = requestAnimationFrame(loop);
  } else {
    lastDropTime = performance.now();
  }
}

export function stopTetris() {
  isRunning = false;
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

// --- Keyboard Handling ---
export function handleTetrisKey(e) {
  if (!isRunning) return false;

  const key = e.key;

  if (key === "ArrowLeft" || key === "h" || key === "H") {
    e.preventDefault();
    moveLeft();
    return true;
  }
  if (key === "ArrowRight" || key === "l" || key === "L") {
    e.preventDefault();
    moveRight();
    return true;
  }
  if (key === "ArrowDown" || key === "j" || key === "J") {
    e.preventDefault();
    softDrop();
    return true;
  }
  if (key === "ArrowUp" || key === "k" || key === "K") {
    e.preventDefault();
    rotatePiece();
    return true;
  }
  if (key === " " || e.code === "Space") {
    e.preventDefault();
    hardDrop();
    return true;
  }
  if (key === "p" || key === "P") {
    e.preventDefault();
    togglePause();
    return true;
  }
  if (key === "r" || key === "R") {
    e.preventDefault();
    resetTetris();
    return true;
  }

  return false;
}

// --- Setup Touch & UI Listeners ---
export function initTetris() {
  const overlayBtn = $("#tetris-overlay-btn");
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      if (gameOver) resetTetris();
      else togglePause();
    });
  }

  // Touch controls
  const touchBtns = document.querySelectorAll(".tetris-touch-btn");
  touchBtns.forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (action === "left") moveLeft();
      else if (action === "right") moveRight();
      else if (action === "down") softDrop();
      else if (action === "rotate") rotatePiece();
      else if (action === "drop") hardDrop();
    });
  });
}
