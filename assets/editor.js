import { $, show, hide } from "./utils.js";

// --- State ---
let isActive = false;
let mode = "normal"; // "normal" | "insert"
let pendingKey = ""; // for multi-key commands like gg, dd, ZZ, r{char}
let undoStack = [];
const STORAGE_KEY = "levon_scratchpad";
let lastSavedText = "";

let textareaEl = null;
let gutterEl = null;
let modeEl = null;
let posEl = null;
let msgEl = null;

let editorCallbacks = {
  onExitToBanner: null,
  onColon: null,
};

// --- Helper Functions ---
function getText() {
  return textareaEl ? textareaEl.value : "";
}

function setText(val) {
  if (textareaEl) {
    textareaEl.value = val;
    updateGutter();
    updatePosition();
  }
}

function pushUndo() {
  if (!textareaEl) return;
  undoStack.push({
    text: textareaEl.value,
    start: textareaEl.selectionStart,
    end: textareaEl.selectionEnd,
  });
  if (undoStack.length > 50) undoStack.shift();
}

export function isEditorActive() {
  return isActive;
}

export function getEditorMode() {
  return mode;
}

export function saveEditorBuffer() {
  const text = getText();
  lastSavedText = text;
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {}
  const lines = text.split("\n").length;
  const bytes = new Blob([text]).size;
  showStatusMessage(`"scratch.txt" ${lines}L, ${bytes}B written`);
  return { lines, bytes };
}

export function showStatusMessage(msg, duration = 3000) {
  if (!msgEl) msgEl = $(".status-bar--msg");
  if (!msgEl) return;
  msgEl.textContent = msg;
  show(msgEl);
  if (duration > 0) {
    setTimeout(() => {
      if (msgEl && msgEl.textContent === msg) {
        hide(msgEl);
      }
    }, duration);
  }
}

// --- Position and Gutter ---
function getCursorPos() {
  if (!textareaEl) return { row: 1, col: 1, totalLines: 1 };
  const text = textareaEl.value;
  const selStart = textareaEl.selectionStart;
  const pre = text.slice(0, selStart);
  const lines = pre.split("\n");
  const row = lines.length;
  const col = lines[lines.length - 1].length + 1;
  const totalLines = text.split("\n").length;
  return { row, col, totalLines, selStart };
}

function updatePosition() {
  if (!posEl) posEl = $(".status-bar--pos");
  if (!posEl || !isActive) return;
  const { row, col, totalLines } = getCursorPos();
  let pct = "All";
  if (totalLines > 1) {
    if (row === 1) pct = "Top";
    else if (row === totalLines) pct = "Bot";
    else pct = `${Math.round((row / totalLines) * 100)}%`;
  }
  posEl.textContent = `${row},${col}        ${pct}`;
}

function updateGutter() {
  if (!gutterEl || !textareaEl) return;
  const text = textareaEl.value;
  const lineCount = text.split("\n").length;

  // Approximate visible lines based on viewport height (line-height ~24px)
  const clientHeight = textareaEl.clientHeight || window.innerHeight;
  const visibleCount = Math.max(lineCount, Math.ceil(clientHeight / 24));

  let html = "";
  for (let i = 1; i <= lineCount; i++) {
    html += `<div class="gutter-num">${i}</div>`;
  }
  for (let i = lineCount + 1; i <= visibleCount; i++) {
    html += `<div class="gutter-tilde">~</div>`;
  }
  gutterEl.innerHTML = html;
}

// --- Mode Setters ---
export function setMode(newMode) {
  mode = newMode;
  pendingKey = "";
  if (!textareaEl) return;

  if (!modeEl) modeEl = $(".status-bar--mode");

  if (mode === "insert") {
    textareaEl.classList.remove("mode-normal");
    textareaEl.classList.add("mode-insert");
    if (modeEl) {
      modeEl.textContent = "-- INSERT --";
      show(modeEl);
    }
  } else {
    // normal mode
    textareaEl.classList.remove("mode-insert");
    textareaEl.classList.add("mode-normal");
    if (modeEl) {
      modeEl.textContent = "-- NORMAL --";
      show(modeEl);
    }
  }
  textareaEl.focus();
  updatePosition();
}

export function handleEditorEscape(e) {
  if (!isActive) return false;
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  if (mode === "insert") {
    setMode("normal");
    if (textareaEl && textareaEl.selectionStart > 0) {
      const pos = textareaEl.selectionStart;
      const text = textareaEl.value;
      if (text[pos - 1] !== "\n") {
        moveCursor(pos - 1);
      }
    }
  } else {
    pendingKey = "";
  }
  return true;
}

// --- Open & Close Editor ---
export function openEditor(startMode = "insert") {
  isActive = true;
  undoStack = [];
  const editorEl = $("#editor");
  const bannerEl = $(".banner");
  if (bannerEl) hide(bannerEl);
  if (editorEl) show(editorEl);

  if (!posEl) posEl = $(".status-bar--pos");
  if (posEl) show(posEl);

  // Re-sync with last saved text
  if (textareaEl && lastSavedText !== undefined) {
    textareaEl.value = lastSavedText;
  }

  setMode(startMode);
  updateGutter();
  updatePosition();
  textareaEl?.focus();
}

export function closeEditor() {
  isActive = false;
  pendingKey = "";
  undoStack = [];

  // Discard unsaved changes: revert to lastSavedText
  if (textareaEl && lastSavedText !== undefined) {
    textareaEl.value = lastSavedText;
    updateGutter();
    updatePosition();
  }

  const editorEl = $("#editor");
  const bannerEl = $(".banner");
  if (editorEl) hide(editorEl);
  if (bannerEl) show(bannerEl);

  if (!modeEl) modeEl = $(".status-bar--mode");
  if (modeEl) hide(modeEl);

  if (!posEl) posEl = $(".status-bar--pos");
  if (posEl) hide(posEl);

  if (!msgEl) msgEl = $(".status-bar--msg");
  if (msgEl) hide(msgEl);

  if (textareaEl) textareaEl.blur();
}

// --- Movement Calculations ---
function getLineIndices(text, pos) {
  const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = text.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = text.length;
  return { lineStart, lineEnd };
}

function moveCursor(newPos) {
  if (!textareaEl) return;
  const max = textareaEl.value.length;
  const clamped = Math.max(0, Math.min(max, newPos));
  textareaEl.selectionStart = clamped;
  textareaEl.selectionEnd = clamped;
  updatePosition();
}

// --- Normal Mode Key Handler ---
export function handleNormalModeKey(e, onExitToBanner) {
  if (!textareaEl) return false;
  const key = e.key;
  const text = textareaEl.value;
  const pos = textareaEl.selectionStart;

  // Multi-key: replace character (r{char})
  if (pendingKey === "r") {
    e.preventDefault();
    pendingKey = "";
    if (key.length === 1 && pos < text.length && text[pos] !== "\n") {
      pushUndo();
      setText(text.slice(0, pos) + key + text.slice(pos + 1));
      moveCursor(pos);
    }
    return true;
  }

  // Multi-key: gg (go to line 1)
  if (pendingKey === "g") {
    e.preventDefault();
    pendingKey = "";
    if (key === "g") {
      moveCursor(0);
      return true;
    }
    return false;
  }

  // Multi-key: dd (delete line)
  if (pendingKey === "d") {
    e.preventDefault();
    pendingKey = "";
    if (key === "d") {
      pushUndo();
      const { lineStart, lineEnd } = getLineIndices(text, pos);
      let nextText = "";
      if (lineEnd < text.length) {
        nextText = text.slice(0, lineStart) + text.slice(lineEnd + 1);
      } else if (lineStart > 0) {
        nextText = text.slice(0, lineStart - 1);
      } else {
        nextText = "";
      }
      setText(nextText);
      moveCursor(Math.min(lineStart, nextText.length));
      return true;
    }
    return false;
  }

  // Multi-key: ZZ (save and quit) or ZQ (quit without save)
  if (pendingKey === "Z") {
    e.preventDefault();
    e.stopPropagation();
    pendingKey = "";
    if (key === "Z") {
      saveEditorBuffer();
      closeEditor();
      if (editorCallbacks.onExitToBanner) editorCallbacks.onExitToBanner();
      return true;
    }
    if (key === "Q") {
      closeEditor();
      if (editorCallbacks.onExitToBanner) editorCallbacks.onExitToBanner();
      return true;
    }
    return false;
  }

  // ESC while in Normal mode -> stay in Normal mode!
  if (key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    pendingKey = "";
    return true;
  }

  // Switch to Insert mode
  if (key === "i") {
    e.preventDefault();
    pushUndo();
    setMode("insert");
    return true;
  }
  if (key === "a") {
    e.preventDefault();
    pushUndo();
    const { lineEnd } = getLineIndices(text, pos);
    if (pos < lineEnd) moveCursor(pos + 1);
    setMode("insert");
    return true;
  }
  if (key === "I") {
    e.preventDefault();
    pushUndo();
    const { lineStart } = getLineIndices(text, pos);
    moveCursor(lineStart);
    setMode("insert");
    return true;
  }
  if (key === "A") {
    e.preventDefault();
    pushUndo();
    const { lineEnd } = getLineIndices(text, pos);
    moveCursor(lineEnd);
    setMode("insert");
    return true;
  }
  if (key === "o") {
    e.preventDefault();
    pushUndo();
    const { lineEnd } = getLineIndices(text, pos);
    setText(text.slice(0, lineEnd) + "\n" + text.slice(lineEnd));
    moveCursor(lineEnd + 1);
    setMode("insert");
    return true;
  }
  if (key === "O") {
    e.preventDefault();
    pushUndo();
    const { lineStart } = getLineIndices(text, pos);
    setText(text.slice(0, lineStart) + "\n" + text.slice(lineStart));
    moveCursor(lineStart);
    setMode("insert");
    return true;
  }

  // Motions: h, j, k, l
  if (key === "h" || key === "ArrowLeft") {
    e.preventDefault();
    const { lineStart } = getLineIndices(text, pos);
    if (pos > lineStart) moveCursor(pos - 1);
    return true;
  }
  if (key === "l" || key === "ArrowRight") {
    e.preventDefault();
    const { lineEnd } = getLineIndices(text, pos);
    if (pos < lineEnd - 1) moveCursor(pos + 1);
    return true;
  }
  if (key === "k" || key === "ArrowUp") {
    e.preventDefault();
    const { lineStart } = getLineIndices(text, pos);
    if (lineStart > 0) {
      const colOffset = pos - lineStart;
      const prevLineIndices = getLineIndices(text, lineStart - 1);
      const prevLineLen = prevLineIndices.lineEnd - prevLineIndices.lineStart;
      const targetCol = Math.min(colOffset, Math.max(0, prevLineLen - 1));
      moveCursor(prevLineIndices.lineStart + targetCol);
    }
    return true;
  }
  if (key === "j" || key === "ArrowDown") {
    e.preventDefault();
    const { lineStart, lineEnd } = getLineIndices(text, pos);
    if (lineEnd < text.length) {
      const colOffset = pos - lineStart;
      const nextLineIndices = getLineIndices(text, lineEnd + 1);
      const nextLineLen = nextLineIndices.lineEnd - nextLineIndices.lineStart;
      const targetCol = Math.min(colOffset, Math.max(0, nextLineLen - 1));
      moveCursor(nextLineIndices.lineStart + targetCol);
    }
    return true;
  }

  // Start / End of line: 0, $
  if (key === "0") {
    e.preventDefault();
    const { lineStart } = getLineIndices(text, pos);
    moveCursor(lineStart);
    return true;
  }
  if (key === "$") {
    e.preventDefault();
    const { lineEnd } = getLineIndices(text, pos);
    moveCursor(Math.max(lineEnd - 1, 0));
    return true;
  }

  // Word jumps: w, b, e
  if (key === "w") {
    e.preventDefault();
    const match = text.slice(pos).search(/\s+\S/);
    if (match !== -1) {
      moveCursor(pos + match + 1);
    } else {
      moveCursor(text.length);
    }
    return true;
  }
  if (key === "b") {
    e.preventDefault();
    const pre = text.slice(0, pos);
    const lastSpace = pre.trimEnd().lastIndexOf(" ");
    const lastNewline = pre.trimEnd().lastIndexOf("\n");
    const target = Math.max(lastSpace, lastNewline);
    moveCursor(target >= 0 ? target + 1 : 0);
    return true;
  }

  // Top / Bottom: gg, G
  if (key === "g") {
    e.preventDefault();
    pendingKey = "g";
    return true;
  }
  if (key === "G") {
    e.preventDefault();
    moveCursor(text.length);
    return true;
  }

  // Delete char: x
  if (key === "x" || key === "Delete") {
    e.preventDefault();
    if (pos < text.length && text[pos] !== "\n") {
      pushUndo();
      setText(text.slice(0, pos) + text.slice(pos + 1));
      moveCursor(pos);
    }
    return true;
  }

  // Replace char: r
  if (key === "r") {
    e.preventDefault();
    pendingKey = "r";
    return true;
  }

  // Delete line prefix: d
  if (key === "d") {
    e.preventDefault();
    pendingKey = "d";
    return true;
  }

  // Save/quit prefix: Z
  if (key === "Z") {
    e.preventDefault();
    pendingKey = "Z";
    return true;
  }

  // Undo: u
  if (key === "u") {
    e.preventDefault();
    if (undoStack.length > 0) {
      const state = undoStack.pop();
      setText(state.text);
      moveCursor(state.start);
    }
    return true;
  }

  // Allow colon ':' to trigger Vim command line mode
  if (key === ":") {
    e.preventDefault();
    e.stopPropagation();
    if (textareaEl) textareaEl.blur();
    if (editorCallbacks.onColon) {
      editorCallbacks.onColon();
    }
    return true;
  }

  // Swallow all other regular typing keys in normal mode
  if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    return true;
  }

  return false;
}

// --- Initialize Editor ---
export function initEditor(options = {}) {
  if (typeof options === "function") {
    editorCallbacks.onExitToBanner = options;
  } else if (options && typeof options === "object") {
    editorCallbacks = { ...editorCallbacks, ...options };
  }

  textareaEl = $("#editor-textarea");
  gutterEl = $("#editor-gutter");
  modeEl = $(".status-bar--mode");
  posEl = $(".status-bar--pos");
  msgEl = $(".status-bar--msg");

  if (!textareaEl) return;

  // Load saved buffer or default
  const PREVIOUS_DEFAULTS = [
    "Welcome to Vim on levon.dev!\nPress i to insert, ESC for normal mode.\nType :w to save, :q to exit.",
    "Welcome to Vim on levon.dev!\nPress ESC for normal mode.\nType :w or :wq to save, :q to exit.",
    "Welcome to Vim on levon.dev!\nPress ESC for normal mode.\nType :w save, :wq to save and quite, or :q to exit.",
  ];
  const DEFAULT_TEXT =
    "Welcome to Vim on levon.dev.\n\nYou are in insert mode, press ESC for normal mode.\nThen type :w to save, :wq to save and quit, or :q to exit.";

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null && !PREVIOUS_DEFAULTS.includes(saved)) {
    textareaEl.value = saved;
    lastSavedText = saved;
  } else {
    textareaEl.value = DEFAULT_TEXT;
    lastSavedText = DEFAULT_TEXT;
  }

  // Sync scroll
  textareaEl.addEventListener("scroll", () => {
    if (gutterEl) gutterEl.scrollTop = textareaEl.scrollTop;
  });

  // Track cursor and text in insert mode
  textareaEl.addEventListener("input", () => {
    updateGutter();
    updatePosition();
  });

  textareaEl.addEventListener("click", () => {
    updatePosition();
  });

  textareaEl.addEventListener("keyup", (e) => {
    e.stopPropagation();
    updatePosition();
  });

  // Prevent browser-native text selection highlight
  textareaEl.addEventListener("select", () => {
    textareaEl.selectionEnd = textareaEl.selectionStart;
  });

  // Handle keydown in textarea
  textareaEl.addEventListener("keydown", (e) => {
    // Block browser Select All (Ctrl+A / Cmd+A)
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Block Shift+Arrow / Shift+Home / Shift+End / Shift+PageUp / Shift+PageDown text selection
    if (
      e.shiftKey &&
      (e.key.startsWith("Arrow") ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageUp" ||
        e.key === "PageDown")
    ) {
      e.preventDefault();
      e.stopPropagation();
      if (mode === "insert") {
        if (e.key === "ArrowLeft" && textareaEl.selectionStart > 0) {
          moveCursor(textareaEl.selectionStart - 1);
        } else if (
          e.key === "ArrowRight" &&
          textareaEl.selectionStart < textareaEl.value.length
        ) {
          moveCursor(textareaEl.selectionStart + 1);
        }
      }
      return;
    }

    // Ctrl+C in insert mode returns to normal mode (authentic Vim behavior)
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "c" || e.key === "C") &&
      mode === "insert"
    ) {
      e.preventDefault();
      e.stopPropagation();
      handleEditorEscape(e);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleEditorEscape(e);
      return;
    }

    if (mode === "insert") {
      // In insert mode, do not leak keys (like ':', 'i', etc.) to document key listeners
      e.stopPropagation();
      return;
    }

    if (mode === "normal") {
      e.stopPropagation();
      handleNormalModeKey(e);
    }
  });

  // Click anywhere in editor focuses textarea
  const editorEl = $("#editor");
  if (editorEl) {
    editorEl.addEventListener("click", (e) => {
      if (e.target !== textareaEl) {
        textareaEl?.focus();
      }
    });
  }
}
