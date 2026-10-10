import { $, show, hide } from "./utils.js";

// --- Config & Constants ---
const ROWS = 9;
const COLS = 9;
const MINES_COUNT = 10;
const STORAGE_BEST_TIME = "levon_mines_best_time";

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
  } catch {}
}

function playDigSound() {
  playTone(600, 0.04, "triangle", 0.06);
}

function playFlagSound() {
  playTone(880, 0.06, "sine", 0.08);
  setTimeout(() => playTone(1174, 0.06, "sine", 0.08), 50);
}

function playWinSound() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, "square", 0.07), i * 90);
  });
}

function playExplodeSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    // White noise explosion
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch {
    playTone(150, 0.25, "sawtooth", 0.1);
  }
}

// --- Game State ---
let grid = [];
let isFirstClick = true;
let isGameOver = false;
let isWon = false;
let isPaused = false;
let timer = 0;
let timerInterval = null;
let flagsCount = 0;
let cursorR = 4;
let cursorC = 4;
let touchMode = "dig"; // "dig" | "flag"

// --- DOM Cache ---
let boardEl = null;
let faceBtn = null;
let mineCountEl = null;
let timerEl = null;
let bestTimeEl = null;
let overlayEl = null;
let overlayMsgEl = null;
let overlayHintEl = null;
let overlayBtnEl = null;
let touchModeBtn = null;

// --- Helper Functions ---
function formatDigits(num) {
  if (num < 0) {
    const abs = Math.min(99, Math.abs(num));
    return `-${String(abs).padStart(2, "0")}`;
  }
  const clamped = Math.min(999, num);
  return String(clamped).padStart(3, "0");
}

function getBestTime() {
  const val = localStorage.getItem(STORAGE_BEST_TIME);
  return val ? Number(val) : null;
}

function updateBestTimeDisplay() {
  if (!bestTimeEl) bestTimeEl = $("#mines-best-time");
  if (!bestTimeEl) return;
  const best = getBestTime();
  bestTimeEl.textContent = best !== null ? `${best}s` : "--";
}

function startTimer() {
  stopTimer();
  timer = 0;
  if (timerEl) timerEl.textContent = formatDigits(timer);
  timerInterval = setInterval(() => {
    if (!isPaused && !isGameOver && !isWon) {
      timer = Math.min(999, timer + 1);
      if (timerEl) timerEl.textContent = formatDigits(timer);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function createEmptyGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      row.push({
        r,
        c,
        isMine: false,
        revealed: false,
        flagged: false,
        neighborMines: 0,
        exploded: false,
      });
    }
    grid.push(row);
  }
}

function placeMines(safeR, safeC) {
  let placed = 0;
  // Pick safe set: safeR, safeC and ideally its neighbors
  const safeCoords = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr;
      const nc = safeC + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        safeCoords.add(`${nr},${nc}`);
      }
    }
  }

  while (placed < MINES_COUNT) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!safeCoords.has(`${r},${c}`) && !grid[r][c].isMine) {
      grid[r][c].isMine = true;
      placed++;
    }
  }

  // Calculate neighbor numbers
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            if (grid[nr][nc].isMine) count++;
          }
        }
      }
      grid[r][c].neighborMines = count;
    }
  }
}

function floodFill(startR, startC) {
  const queue = [[startR, startC]];
  const visited = new Set();
  visited.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const cell = grid[r][c];
    cell.revealed = true;

    if (cell.neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            const nCell = grid[nr][nc];
            const key = `${nr},${nc}`;
            if (!visited.has(key) && !nCell.isMine && !nCell.flagged) {
              visited.add(key);
              if (nCell.neighborMines === 0) {
                queue.push([nr, nc]);
              } else {
                nCell.revealed = true;
              }
            }
          }
        }
      }
    }
  }
}

function checkWin() {
  let unrevealedSafeCells = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (!cell.isMine && !cell.revealed) {
        unrevealedSafeCells++;
      }
    }
  }
  return unrevealedSafeCells === 0;
}

function triggerWin() {
  isWon = true;
  isGameOver = true;
  stopTimer();
  if (faceBtn) faceBtn.textContent = "😎";

  // Flag all mines nicely
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].isMine) {
        grid[r][c].flagged = true;
      }
    }
  }
  flagsCount = MINES_COUNT;
  if (mineCountEl) mineCountEl.textContent = formatDigits(0);

  // Best time save
  const currentBest = getBestTime();
  if (currentBest === null || timer < currentBest) {
    try {
      localStorage.setItem(STORAGE_BEST_TIME, timer);
    } catch {}
    updateBestTimeDisplay();
  }

  playWinSound();
  renderBoard();
}

function triggerGameOver(hitR, hitC) {
  isGameOver = true;
  isWon = false;
  stopTimer();
  if (faceBtn) faceBtn.textContent = "😵";

  if (hitR !== undefined && hitC !== undefined) {
    grid[hitR][hitC].exploded = true;
  }

  // Reveal all mines & mark false flags
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.isMine) {
        if (!cell.flagged) cell.revealed = true;
      } else if (cell.flagged) {
        cell.misflagged = true;
      }
    }
  }

  playExplodeSound();
  renderBoard();
}

// --- Action Handlers ---
export function revealCell(r, c) {
  if (isGameOver || isWon || isPaused) return;
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;

  if (isFirstClick) {
    isFirstClick = false;
    placeMines(r, c);
    startTimer();
  }

  if (cell.isMine) {
    triggerGameOver(r, c);
    return;
  }

  playDigSound();
  floodFill(r, c);

  if (checkWin()) {
    triggerWin();
  } else {
    renderBoard();
  }
}

export function toggleFlag(r, c) {
  if (isGameOver || isWon || isPaused) return;
  const cell = grid[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  flagsCount += cell.flagged ? 1 : -1;
  playFlagSound();

  if (mineCountEl) {
    mineCountEl.textContent = formatDigits(MINES_COUNT - flagsCount);
  }
  renderBoard();
}

// --- Rendering ---
function renderBoard() {
  if (!boardEl) return;
  boardEl.innerHTML = "";

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mines-cell";
      btn.dataset.r = r;
      btn.dataset.c = c;

      if (r === cursorR && c === cursorC) {
        btn.classList.add("cursor-active");
      }

      if (cell.revealed) {
        btn.classList.add("revealed");
        if (cell.isMine) {
          btn.classList.add("mine");
          if (cell.exploded) btn.classList.add("exploded");
          btn.textContent = "💣";
        } else if (cell.neighborMines > 0) {
          btn.classList.add(`num-${cell.neighborMines}`);
          btn.textContent = cell.neighborMines;
        }
      } else if (cell.flagged) {
        btn.classList.add("flagged");
        if (cell.misflagged) {
          btn.classList.add("misflagged");
          btn.textContent = "❌";
        } else {
          btn.textContent = "🚩";
        }
      }

      // Mouse events
      btn.addEventListener("mousedown", (e) => {
        if (e.button === 0 && !isGameOver && !isWon && faceBtn) {
          faceBtn.textContent = "😮";
        }
      });

      btn.addEventListener("mouseup", () => {
        if (!isGameOver && !isWon && faceBtn) {
          faceBtn.textContent = "🙂";
        }
      });

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        cursorR = r;
        cursorC = c;
        if (touchMode === "flag") {
          toggleFlag(r, c);
        } else {
          revealCell(r, c);
        }
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        cursorR = r;
        cursorC = c;
        toggleFlag(r, c);
      });

      boardEl.appendChild(btn);
    }
  }
}

// --- Public Game Lifecycle ---
export function resetMinesweeper() {
  stopTimer();
  isFirstClick = true;
  isGameOver = false;
  isWon = false;
  isPaused = false;
  timer = 0;
  flagsCount = 0;
  cursorR = 4;
  cursorC = 4;

  if (faceBtn) faceBtn.textContent = "🙂";
  if (timerEl) timerEl.textContent = "000";
  if (mineCountEl) mineCountEl.textContent = formatDigits(MINES_COUNT);
  hideOverlay();

  createEmptyGrid();
  renderBoard();
  updateBestTimeDisplay();
}

function showOverlay(msg, btnText, hintText = "") {
  if (!overlayEl) return;
  if (overlayMsgEl) overlayMsgEl.textContent = msg;
  if (overlayBtnEl) overlayBtnEl.textContent = btnText;
  if (overlayHintEl) overlayHintEl.innerHTML = hintText;
  show(overlayEl);
}

function hideOverlay() {
  if (overlayEl) hide(overlayEl);
}

export function startMinesweeper() {
  resetMinesweeper();
}

export function pauseMinesweeper() {
  if (isGameOver || isWon || isPaused) return;
  isPaused = true;
  showOverlay(
    "PAUSED",
    "Resume",
    "Press <strong>P</strong> to resume<br>or type <strong>:pause</strong>",
  );
}

export function togglePause() {
  if (isGameOver || isWon) return;
  isPaused = !isPaused;
  if (isPaused) {
    showOverlay(
      "PAUSED",
      "Resume",
      "Press <strong>P</strong> to resume<br>or type <strong>:pause</strong>",
    );
  } else {
    hideOverlay();
  }
}

export function stopMinesweeper() {
  stopTimer();
  hideOverlay();
}

// --- Keyboard Controls ---
export function handleMinesweeperKey(e) {
  const key = e.key;

  if (key === "ArrowLeft" || key === "h" || key === "H") {
    e.preventDefault();
    cursorC = Math.max(0, cursorC - 1);
    renderBoard();
    return true;
  }
  if (key === "ArrowRight" || key === "l" || key === "L") {
    e.preventDefault();
    cursorC = Math.min(COLS - 1, cursorC + 1);
    renderBoard();
    return true;
  }
  if (key === "ArrowUp" || key === "k" || key === "K") {
    e.preventDefault();
    cursorR = Math.max(0, cursorR - 1);
    renderBoard();
    return true;
  }
  if (key === "ArrowDown" || key === "j" || key === "J") {
    e.preventDefault();
    cursorR = Math.min(ROWS - 1, cursorR + 1);
    renderBoard();
    return true;
  }
  if (key === " " || key === "Enter") {
    e.preventDefault();
    revealCell(cursorR, cursorC);
    return true;
  }
  if (key === "f" || key === "F") {
    e.preventDefault();
    toggleFlag(cursorR, cursorC);
    return true;
  }
  if (key === "r" || key === "R") {
    e.preventDefault();
    resetMinesweeper();
    return true;
  }
  if (key === "p" || key === "P") {
    e.preventDefault();
    togglePause();
    return true;
  }

  return false;
}

// --- Setup DOM & Listeners ---
export function initMinesweeper() {
  boardEl = $("#mines-board");
  faceBtn = $("#mines-face-btn");
  mineCountEl = $("#mines-count");
  timerEl = $("#mines-timer");
  bestTimeEl = $("#mines-best-time");
  overlayEl = $("#mines-overlay");
  overlayMsgEl = $("#mines-overlay-msg");
  overlayHintEl = $("#mines-overlay-hint");
  overlayBtnEl = $("#mines-overlay-btn");
  touchModeBtn = $("#mines-touch-mode-btn");

  if (faceBtn) {
    faceBtn.addEventListener("click", () => {
      resetMinesweeper();
    });
  }

  if (overlayBtnEl) {
    overlayBtnEl.addEventListener("click", () => {
      if (isPaused) togglePause();
      else resetMinesweeper();
    });
  }

  if (touchModeBtn) {
    touchModeBtn.addEventListener("click", () => {
      touchMode = touchMode === "dig" ? "flag" : "dig";
      touchModeBtn.textContent = touchMode === "dig" ? "⛏️ Dig" : "🚩 Flag";
      touchModeBtn.classList.toggle("flag-mode", touchMode === "flag");
    });
  }

  updateBestTimeDisplay();
}
