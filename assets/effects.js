import { $ } from "./utils.js";

export const THEMES = {
  light: { bg: "#f1f1f1", font: "#1a1a1a", key: "#0037ff" },
  dark: { bg: "#283237", font: "#fff", key: "#60b9ec" },
  matrix: { bg: "#000", font: "#0f0", key: "#0f0" },
};

let matrixAnim = null;

export function toggleMatrix() {
  const vim = $("#vim");
  if (!vim) return;

  if (matrixAnim) {
    clearInterval(matrixAnim);
    matrixAnim = null;
    const c = document.getElementById("matrix-canvas");
    if (c) c.remove();
    vim.classList.remove("matrix-active");
    return;
  }

  vim.classList.add("matrix-active");

  const canvas = document.createElement("canvas");
  canvas.id = "matrix-canvas";
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "0",
    pointerEvents: "none",
  });
  vim.prepend(canvas);

  const ctx = canvas.getContext("2d");
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const chars =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";
  const fontSize = 14;
  const cols = Math.floor(canvas.width / fontSize);
  const drops = Array(cols).fill(1);

  matrixAnim = setInterval(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f0";
    ctx.font = fontSize + "px monospace";

    for (let i = 0; i < drops.length; i++) {
      const c = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(c, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }, 50);
}

let clockInterval = null;
let clockSpan = null;

export function toggleClock() {
  const statusBar = $("#vim .status-bar");
  if (!statusBar) return;

  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
    if (clockSpan) {
      clockSpan.remove();
      clockSpan = null;
    }
    return;
  }

  clockSpan = document.createElement("span");
  clockSpan.className = "status-bar--clock";
  statusBar.appendChild(clockSpan);

  const update = () => {
    clockSpan.textContent = new Date().toLocaleTimeString();
  };
  update();
  clockInterval = setInterval(update, 1000);
}

export function toggleWobble() {
  const vim = $("#vim");
  if (vim) vim.classList.toggle("wobble");
}

let audioCtx = null;

export function beep() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square";
  osc.frequency.value = 440;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

export function changeTheme(name) {
  const vim = $("#vim");
  if (!vim) return;
  vim.classList.remove("light", "dark", "matrix");
  vim.classList.add(name);
  const colors = THEMES[name];
  if (colors) {
    document.body.style.setProperty("--color-bg", colors.bg);
    document.body.style.setProperty("--color-font", colors.font);
    document.body.style.setProperty("--color-key", colors.key);
  }

  if (
    (name === "matrix" && !matrixAnim) ||
    (name !== "matrix" && matrixAnim)
  ) {
    toggleMatrix();
  }
}
