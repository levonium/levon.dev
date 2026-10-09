import { $, $$, show, hide } from "./utils.js";
import {
  LETTER_KEYS,
  NAV_SECTIONS,
  LEGAL_COMMANDS,
  SECONDARY_COMMANDS,
  QUIT_COMMANDS,
  changePhoto,
} from "./commands.js";
import { initTetris } from "./tetris.js";
import { initSnake } from "./snake.js";
import {
  getActiveGameName,
  pauseActiveGame,
  stopActiveGame,
  handleActiveGameKey,
  returnToGamesMenu,
  onGameStateChange,
} from "./gameManager.js";
import {
  initEditor,
  openEditor,
  closeEditor,
  isEditorActive,
  getEditorMode,
  saveEditorBuffer,
  handleEditorEscape,
  handleNormalModeKey,
} from "./editor.js";

// --- State ---
const state = {
  shouldStartEditor: true,
  confirmQuit: false,
  openPopup: "",
};

let removeCommandMode = null;
const popupHooks = new Map();

export function registerPopupHook(name, hooks) {
  popupHooks.set(name, hooks);
}

// --- DOM refs ---
const vim = $("#vim");
const banner = vim.querySelector(".banner");
const popup = vim.querySelector(".popup");
const popupWrapper = popup.querySelector(".popup .wrapper");
const statusBar = vim.querySelector(".status-bar");
const colonSpan = statusBar.querySelector(".status-bar--colon");
const commandSpan = statusBar.querySelector(".status-bar--command");
const errorSpan = statusBar.querySelector(".status-bar--error");
const errorCmdSpan = errorSpan.querySelector(".status-bar--error--command");
const modeSpan = statusBar.querySelector(".status-bar--mode");
const quitSpan = statusBar.querySelector(".status-bar--q");

// === Functions ===

function updateCommand(text) {
  commandSpan.innerText = text;
}

function toggleErrorSpan(command = "") {
  if (command) {
    show(errorSpan);
    errorCmdSpan.innerText = command;
  } else {
    hide(errorSpan);
  }
}

function toggleStatusBar() {
  hide(modeSpan);
  const msgEl = statusBar.querySelector(".status-bar--msg");
  if (msgEl) hide(msgEl);
  show(colonSpan);
  show(commandSpan);
  hide(quitSpan);
  toggleErrorSpan();
}

function exitCommandMode() {
  cleanupCommandMode();
  [colonSpan, commandSpan].forEach(hide);
  commandSpan.innerText = "";
  state.shouldStartEditor = true;
  if (!isEditorActive()) {
    hide(modeSpan);
  } else {
    if (modeSpan) {
      modeSpan.textContent =
        getEditorMode() === "insert" ? "-- INSERT --" : "-- NORMAL --";
      show(modeSpan);
    }
    $("#editor-textarea")?.focus();
  }
}

export function openPopup(command) {
  if (isEditorActive()) closeEditor();

  if (state.openPopup && state.openPopup !== command) {
    const prevHooks = popupHooks.get(state.openPopup);
    if (prevHooks?.onClose) prevHooks.onClose();
  }

  state.openPopup = command;
  state.confirmQuit = false;
  show(popup);
  popupWrapper.focus();
  popup.querySelectorAll("article").forEach((a) => hide(a));
  const targetArticle = popup.querySelector(`.popup--${command}`);
  if (targetArticle) show(targetArticle);
  buildMobileActions(command);

  const titleEl = document.querySelector(".popup .titlebar .title");
  if (titleEl)
    titleEl.textContent = command.charAt(0).toUpperCase() + command.slice(1);

  const hooks = popupHooks.get(command);
  if (hooks?.onOpen) hooks.onOpen();
}

export function closePopup() {
  if (state.openPopup) {
    const hooks = popupHooks.get(state.openPopup);
    if (hooks?.onClose) hooks.onClose();
  }

  hide(popup);
  popup.querySelectorAll("article").forEach((a) => hide(a));
  const container = document.querySelector(".mobile-actions");
  if (container) container.innerHTML = "";
  state.openPopup = "";
}

function executeCommand(command) {
  if (isEditorActive()) {
    if (command === "q" || command === "q!") {
      closeEditor();
      exitCommandMode();
      return;
    }
    if (command === "w" || command === "w!") {
      saveEditorBuffer();
      exitCommandMode();
      return;
    }
    if (command === "wq" || command === "wq!" || command === "x") {
      saveEditorBuffer();
      closeEditor();
      exitCommandMode();
      return;
    }
  }

  if (command === "e" || command === "edit") {
    openEditor("normal");
    exitCommandMode();
    return;
  }

  if (LEGAL_COMMANDS.includes(command)) {
    if (command === "q") {
      state.confirmQuit = true;
      show(quitSpan);
    } else {
      openPopup(command);
    }
  } else if (
    SECONDARY_COMMANDS.some((c) => c.name === command) ||
    command === "game 1" ||
    command === "game 2"
  ) {
    const activeGame = getActiveGameName();
    let cmd = SECONDARY_COMMANDS.find((c) => {
      if (c.name !== command || c.article !== state.openPopup) return false;
      if (c.article === "games") {
        if (c.inGame === true && !activeGame) return false;
        if (c.inGame === false && activeGame) return false;
      }
      return true;
    });
    if (!cmd && (command === "game 1" || command === "game 2")) {
      const gameName = command === "game 1" ? "tetris" : "snake";
      if (state.openPopup !== "games") openPopup("games");
      cmd = SECONDARY_COMMANDS.find(
        (c) => c.name === gameName && c.article === "games",
      );
    }
    if (!cmd && state.openPopup !== "games" && (command === "tetris" || command === "snake")) {
      openPopup("games");
      cmd = SECONDARY_COMMANDS.find(
        (c) => c.name === command && c.article === "games",
      );
    }
    if (cmd) {
      cmd.fn();
    } else {
      toggleErrorSpan(command);
    }
  } else if (command in QUIT_COMMANDS) {
    if (state.confirmQuit) {
      QUIT_COMMANDS[command].fn();
    } else {
      toggleErrorSpan(command);
    }
    state.confirmQuit = false;
  } else {
    toggleErrorSpan(command);
  }

  exitCommandMode();
}

function cleanupCommandMode() {
  if (removeCommandMode) {
    removeCommandMode();
    removeCommandMode = null;
  }
}

function listenToKeyEvents() {
  cleanupCommandMode();

  let command = "";

  const handler = (e) => {
    const key = e.key;

    if (key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      exitCommandMode();
      return;
    }

    if (key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      if (command.length === 0) {
        exitCommandMode();
        return;
      }
      command = command.slice(0, -1);
      updateCommand(command);
      return;
    }

    if (key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (command.length > 0) executeCommand(command);
      else exitCommandMode();
      return;
    }

    if (
      e.code in LETTER_KEYS ||
      key === "!" ||
      key === "-" ||
      key === "_" ||
      key === "/" ||
      key === "."
    ) {
      e.preventDefault();
      e.stopPropagation();
      command += key;
      updateCommand(command);
    }
  };

  document.addEventListener("keydown", handler);
  removeCommandMode = () => document.removeEventListener("keydown", handler);
}

function buildStartMenu() {
  const menu = document.getElementById("start-menu");
  if (!menu) return;
  NAV_SECTIONS.forEach((section) => {
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = section.charAt(0).toUpperCase() + section.slice(1);
    item.addEventListener("click", () => {
      openPopup(section);
      menu.classList.add("hidden");
    });
    item.addEventListener("mouseenter", () => {
      menu
        .querySelectorAll(".selected")
        .forEach((el) => el.classList.remove("selected"));
      item.classList.add("selected");
    });
    menu.appendChild(item);
  });
}

function buildMobileActions(section) {
  const container = document.querySelector(".mobile-actions");
  if (!container) return;
  container.innerHTML = "";

  const activeGame = getActiveGameName();
  const entries = SECONDARY_COMMANDS.filter((cmd) => {
    if (cmd.article !== section) return false;
    if (section === "games") {
      if (cmd.inGame === true && !activeGame) return false;
      if (cmd.inGame === false && activeGame) return false;
    }
    return true;
  });
  if (entries.length === 0) return;

  entries.forEach((cmd) => {
    const btn = document.createElement("button");
    btn.textContent = cmd.name;
    btn.addEventListener("click", () => cmd.fn());
    container.appendChild(btn);
  });
}

// --- Blinking caret ---
function blink() {
  if (document.body.clientWidth < 813) return;
  const carets = $$(".has-caret");
  setInterval(() => {
    carets.forEach((el) => {
      if (!el.classList.contains("hidden")) {
        el.classList.toggle("blink");
      }
    });
  }, 500);
}

// === Event listeners ===

registerPopupHook("games", {
  onOpen: () => {
    if (!getActiveGameName()) {
      returnToGamesMenu();
    }
  },
  onClose: () => {
    stopActiveGame();
  },
});

// Editor: press i to enter insert mode
document.addEventListener("keyup", (e) => {
  if (
    e.key === "i" &&
    state.shouldStartEditor &&
    !isEditorActive() &&
    !state.openPopup &&
    !removeCommandMode
  ) {
    toggleErrorSpan();
    closePopup();
    openEditor("insert");
  }
});

// Global: : for command mode, Escape to close popup
document.addEventListener("keydown", (e) => {
  if (removeCommandMode) return;

  if (e.key === ":") {
    state.shouldStartEditor = false;
    if (state.openPopup === "games") pauseActiveGame();
    if (isEditorActive()) {
      $("#editor-textarea")?.blur();
    }
    toggleStatusBar();
    listenToKeyEvents();
  } else if (e.key === "Escape") {
    if (state.openPopup) {
      closePopup();
      document.getElementById("start-menu")?.classList.add("hidden");
    } else if (
      isEditorActive() &&
      e.target !== document.getElementById("editor-textarea")
    ) {
      handleEditorEscape(e);
    }
  } else if (
    state.openPopup === "games" &&
    getActiveGameName()
  ) {
    handleActiveGameKey(e);
  } else if (
    isEditorActive() &&
    getEditorMode() === "normal" &&
    e.target !== document.getElementById("editor-textarea")
  ) {
    handleNormalModeKey(e);
  }
});

// Win95: start menu toggle
const startBtn = document.getElementById("start-btn");
const startMenu = document.getElementById("start-menu");
if (startBtn && startMenu) {
  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startMenu.classList.toggle("hidden");
  });
  document.addEventListener("click", () => {
    startMenu.classList.add("hidden");
  });
  startMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

// Win95: title bar buttons
document.querySelectorAll(".popup .titlebar .close").forEach((btn) => {
  btn.addEventListener("click", closePopup);
});
document.querySelectorAll(".popup .titlebar .min").forEach((btn) => {
  btn.addEventListener("click", closePopup);
});

// === Init ===
blink();
changePhoto(2008);
buildStartMenu();
initTetris();
initSnake();
initEditor({
  onExitToBanner: () => {
    state.shouldStartEditor = true;
  },
  onColon: () => {
    state.shouldStartEditor = false;
    toggleStatusBar();
    listenToKeyEvents();
  },
});
onGameStateChange(() => {
  if (state.openPopup === "games") {
    buildMobileActions("games");
  }
});

// Win95: taskbar clock (always on)
const taskbarClock = document.querySelector(".clock");
if (taskbarClock) {
  const update = () => {
    taskbarClock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  update();
  setInterval(update, 30000);
}
