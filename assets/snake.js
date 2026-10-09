import { $, show, hide } from "./utils.js";

// --- Config & Constants ---
const COLS = 20;
const ROWS = 20;
const CELL_SIZE = 12;

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

function playEatSound() {
  playTone(523, 0.08, "sine", 0.08);
  setTimeout(() => playTone(659, 0.08, "sine", 0.08), 50);
}

function playMoveSound() {
  playTone(240, 0.02, "triangle", 0.02);
}

function playGameOverSound() {
  const tones = [330, 290, 250, 200];
  tones.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 0.12, "sawtooth", 0.06), idx * 80);
  });
}

// --- Game State ---
let snake = [];
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = { x: 15, y: 10 };
let score = 0;
let highScore = Number(localStorage.getItem("levon_snake_highscore") || 0);
let gameOver = false;
let isPaused = false;
let isRunning = false;
let animId = null;
let lastTickTime = 0;

function resetState() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  gameOver = false;
  isPaused = false;
  spawnFood();
  updateUI();
}

function spawnFood() {
  while (true) {
    const fx = Math.floor(Math.random() * COLS);
    const fy = Math.floor(Math.random() * ROWS);
    const collision = snake.some((s) => s.x === fx && s.y === fy);
    if (!collision) {
      food = { x: fx, y: fy };
      break;
    }
  }
}

function getSpeed() {
  return Math.max(65, 125 - Math.floor(score / 30) * 8);
}

// --- Movement & Logic ---
function tick() {
  if (!isRunning || isPaused || gameOver) return;

  dir = { ...nextDir };
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision check
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    endGame();
    return;
  }

  // Self collision check
  if (snake.some((s) => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  // Check food
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem("levon_snake_highscore", highScore);
      } catch {}
    }
    playEatSound();
    spawnFood();
    updateUI();
  } else {
    snake.pop();
  }

  draw();
}

function endGame() {
  gameOver = true;
  playGameOverSound();
  showOverlay(
    "GAME OVER",
    "Restart",
    "Press <strong>R</strong> to restart<br>or type <strong>:restart</strong>",
  );
}

// --- Direction Setters ---
function setDirection(x, y) {
  if (dir.x !== 0 && x !== 0) return;
  if (dir.y !== 0 && y !== 0) return;
  nextDir = { x, y };
  playMoveSound();
}

// --- Rendering ---
function draw() {
  const canvas = $("#snake-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Subtle background grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(COLS * CELL_SIZE, r * CELL_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, ROWS * CELL_SIZE);
    ctx.stroke();
  }

  // Food
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(
    food.x * CELL_SIZE + 1,
    food.y * CELL_SIZE + 1,
    CELL_SIZE - 2,
    CELL_SIZE - 2,
  );
  // Highlight on food
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, 3, 3);

  // Snake body
  snake.forEach((seg, index) => {
    const isHead = index === 0;
    ctx.fillStyle = isHead ? "#4ade80" : "#22c55e";
    ctx.fillRect(
      seg.x * CELL_SIZE + 1,
      seg.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
    );

    // Bevel highlights
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, 1);
    ctx.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, 1, CELL_SIZE - 2);

    // Eyes on head
    if (isHead) {
      ctx.fillStyle = "#0c0d0e";
      const eyeOffset = 3;
      if (dir.x === 1) {
        ctx.fillRect(seg.x * CELL_SIZE + 8, seg.y * CELL_SIZE + 3, 2, 2);
        ctx.fillRect(seg.x * CELL_SIZE + 8, seg.y * CELL_SIZE + 7, 2, 2);
      } else if (dir.x === -1) {
        ctx.fillRect(seg.x * CELL_SIZE + 2, seg.y * CELL_SIZE + 3, 2, 2);
        ctx.fillRect(seg.x * CELL_SIZE + 2, seg.y * CELL_SIZE + 7, 2, 2);
      } else if (dir.y === 1) {
        ctx.fillRect(seg.x * CELL_SIZE + 3, seg.y * CELL_SIZE + 8, 2, 2);
        ctx.fillRect(seg.x * CELL_SIZE + 7, seg.y * CELL_SIZE + 8, 2, 2);
      } else {
        ctx.fillRect(seg.x * CELL_SIZE + 3, seg.y * CELL_SIZE + 2, 2, 2);
        ctx.fillRect(seg.x * CELL_SIZE + 7, seg.y * CELL_SIZE + 2, 2, 2);
      }
    }
  });
}

function updateUI() {
  const scoreEl = $("#snake-score");
  const lengthEl = $("#snake-length");
  const highEl = $("#snake-high");
  if (scoreEl) scoreEl.textContent = score;
  if (lengthEl) lengthEl.textContent = snake.length;
  if (highEl) highEl.textContent = highScore;
}

function showOverlay(msg, btnText, hintText = "") {
  const overlay = $("#snake-overlay");
  const msgEl = $("#snake-overlay-msg");
  const btnEl = $("#snake-overlay-btn");
  const hintEl = $("#snake-overlay-hint");
  if (!overlay) return;
  if (msgEl) msgEl.textContent = msg;
  if (btnEl) btnEl.textContent = btnText;
  if (hintEl) hintEl.innerHTML = hintText;
  show(overlay);
}

function hideOverlay() {
  const overlay = $("#snake-overlay");
  if (overlay) hide(overlay);
}

// --- Game Loop ---
function loop(timestamp) {
  if (!isRunning) return;

  if (!isPaused && !gameOver) {
    if (!lastTickTime) lastTickTime = timestamp;
    const interval = getSpeed();
    if (timestamp - lastTickTime > interval) {
      tick();
      lastTickTime = timestamp;
    }
  }

  animId = requestAnimationFrame(loop);
}

// --- Public Controls ---
export function startSnake() {
  if (!isRunning) {
    isRunning = true;
    if (gameOver || snake.length === 0) {
      resetState();
    }
    isPaused = false;
    hideOverlay();
    lastTickTime = performance.now();
    draw();
    updateUI();
    animId = requestAnimationFrame(loop);
  } else if (isPaused && !gameOver) {
    togglePause();
  }
}

export function pauseSnake() {
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
    resetSnake();
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
    lastTickTime = performance.now();
  }
}

export function resetSnake() {
  resetState();
  hideOverlay();
  lastTickTime = performance.now();
  draw();
  updateUI();

  if (!isRunning) {
    isRunning = true;
    animId = requestAnimationFrame(loop);
  }
}

export function stopSnake() {
  isRunning = false;
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

// --- Keyboard Handler ---
export function handleSnakeKey(e) {
  if (!isRunning) return false;

  const key = e.key;

  if (key === "ArrowLeft" || key === "h" || key === "H") {
    e.preventDefault();
    setDirection(-1, 0);
    return true;
  }
  if (key === "ArrowRight" || key === "l" || key === "L") {
    e.preventDefault();
    setDirection(1, 0);
    return true;
  }
  if (key === "ArrowUp" || key === "k" || key === "K") {
    e.preventDefault();
    setDirection(0, -1);
    return true;
  }
  if (key === "ArrowDown" || key === "j" || key === "J") {
    e.preventDefault();
    setDirection(0, 1);
    return true;
  }
  if (key === "p" || key === "P") {
    e.preventDefault();
    togglePause();
    return true;
  }
  if (key === "r" || key === "R") {
    e.preventDefault();
    resetSnake();
    return true;
  }

  return false;
}

// --- Setup Touch & Overlay Listeners ---
export function initSnake() {
  const overlayBtn = $("#snake-overlay-btn");
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      if (gameOver) resetSnake();
      else togglePause();
    });
  }

  const touchBtns = document.querySelectorAll("[data-snake-action]");
  touchBtns.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const action = btn.dataset.snakeAction;
      if (action === "up") setDirection(0, -1);
      else if (action === "left") setDirection(-1, 0);
      else if (action === "down") setDirection(0, 1);
      else if (action === "right") setDirection(1, 0);
    });
  });
}
