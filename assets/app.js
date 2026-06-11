(() => {
  // --- Helpers ---
  const $ = (sel) =>
    sel.startsWith("#")
      ? document.getElementById(sel.slice(1))
      : document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const show = (el) => el.classList.remove("hidden");
  const hide = (el) => el.classList.add("hidden");

  // --- Theme ---
  const THEMES = {
    light: { bg: "#f1f1f1", font: "#1a1a1a", key: "#0037ff" },
    dark: { bg: "#283237", font: "#fff", key: "#60b9ec" },
    matrix: { bg: "#000", font: "#0f0", key: "#0f0" },
  };

  // --- Command definitions ---
  const LEGAL_COMMANDS = [
    "q",
    "help",
    "settings",
    "email",
    "telegram",
    "photo",
    "source",
    "posts",
    "projects",
    "privacy",
    "terms",
  ];

  const NAV_SECTIONS = LEGAL_COMMANDS.filter(
    (c) => c !== "q" && c !== "help" && c !== "settings",
  );

  const QUIT_COMMANDS = {
    yes: {
      fn: () =>
        alert(
          "Sorry, I can't close the browser tab, you'll have to do it yourself. Bye.",
        ),
    },
    no: { fn: () => hide(quitSpan) },
  };

  const LETTER_KEYS = {
    Space: " ",
    Digit1: "1",
    Digit2: "2",
    Digit3: "3",
    Digit4: "4",
    Digit5: "5",
    Digit6: "6",
    Digit7: "7",
    Digit8: "8",
    Digit9: "9",
    Digit0: "0",
    KeyA: "a",
    KeyB: "b",
    KeyC: "c",
    KeyD: "d",
    KeyE: "e",
    KeyF: "f",
    KeyG: "g",
    KeyH: "h",
    KeyI: "i",
    KeyJ: "j",
    KeyK: "k",
    KeyL: "l",
    KeyM: "m",
    KeyN: "n",
    KeyO: "o",
    KeyP: "p",
    KeyQ: "q",
    KeyR: "r",
    KeyS: "s",
    KeyT: "t",
    KeyU: "u",
    KeyV: "v",
    KeyW: "w",
    KeyX: "x",
    KeyY: "y",
    KeyZ: "z",
  };

  // --- State ---
  const state = {
    shouldStartEditor: true,
    confirmQuit: false,
    openPopup: "",
  };

  let removeCommandMode = null;

  // --- DOM refs ---
  const vim = $("#vim");
  const banner = vim.querySelector(".banner");
  const editor = vim.querySelector(".editor");
  const editorLabel = editor.querySelector(".editor--label");
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

  function toggleEditorCaret() {
    if (editor.classList.contains("has-caret")) {
      editor.classList.remove("has-caret");
    } else if (!editor.innerText) {
      editor.classList.add("has-caret");
    }
  }

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
    show(colonSpan);
    show(commandSpan);
    hide(quitSpan);
    toggleErrorSpan();
    toggleEditorCaret();
  }

  function exitCommandMode() {
    cleanupCommandMode();
    [modeSpan, colonSpan, commandSpan].forEach(hide);
    commandSpan.innerText = "";
    toggleEditorCaret();
    state.shouldStartEditor = true;
  }

  function openPopup(command) {
    state.openPopup = command;
    state.confirmQuit = false;
    show(popup);
    popupWrapper.focus();
    popup.querySelectorAll("article").forEach((a) => hide(a));
    show(popup.querySelector(`.popup--${command}`));
    buildMobileActions(command);

    const titleEl = document.querySelector(".popup .titlebar .title");
    if (titleEl)
      titleEl.textContent = command.charAt(0).toUpperCase() + command.slice(1);
  }

  function closePopup() {
    hide(popup);
    popup.querySelectorAll("article").forEach((a) => hide(a));
    const container = document.querySelector(".mobile-actions");
    if (container) container.innerHTML = "";
    state.openPopup = "";
  }

  function executeCommand(command) {
    if (LEGAL_COMMANDS.includes(command)) {
      if (command === "q") {
        state.confirmQuit = true;
        show(quitSpan);
      } else {
        openPopup(command);
      }
    } else if (command in SECONDARY_COMMANDS) {
      const cmd = SECONDARY_COMMANDS[command];
      if (cmd.article === state.openPopup) {
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
        exitCommandMode();
        return;
      }

      if (key === "Backspace") {
        if (command.length === 0) {
          exitCommandMode();
          return;
        }
        command = command.slice(0, -1);
        updateCommand(command);
        return;
      }

      if (key === "Enter") {
        if (command.length > 0) executeCommand(command);
        else exitCommandMode();
        return;
      }

      if (e.code in LETTER_KEYS) {
        command += key;
        updateCommand(command);
      }
    };

    document.addEventListener("keydown", handler);
    removeCommandMode = () => document.removeEventListener("keydown", handler);
  }

  // --- Secondary actions ---

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(["levon", "levon.dev"].join("@"));
    } catch {
      alert("Could not copy email. Make sure the page is served over HTTPS.");
    }
  }

  function openLink(url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener,noreferrer";
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  let currentPhotoYear = 2008;

  function changePhoto(year) {
    currentPhotoYear = year;
    const img = $("#levon");
    if (!img) return;
    img.src = `assets/levon-${year}.jpg`;
    img.style.filter = "unset";

    popup.querySelectorAll("[data-photo-year]").forEach((el) => {
      el.classList.toggle("hidden", Number(el.dataset.photoYear) === year);
    });
  }

  // --- Win95 taskbar & start menu ---

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

    const entries = Object.entries(SECONDARY_COMMANDS).filter(
      ([, cmd]) => cmd.article === section,
    );
    if (entries.length === 0) return;

    entries.forEach(([key]) => {
      const btn = document.createElement("button");
      btn.textContent = key;
      btn.addEventListener("click", () => {
        const cmd = SECONDARY_COMMANDS[key];
        if (cmd) cmd.fn();
      });
      container.appendChild(btn);
    });
  }

  let matrixAnim = null;

  function toggleMatrix() {
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

  function toggleClock() {
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

  function toggleWobble() {
    vim.classList.toggle("wobble");
  }

  let audioCtx = null;

  function beep() {
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

  function changeTheme(name) {
    vim.classList.remove("light", "dark", "matrix");
    vim.classList.add(name);
    const colors = THEMES[name];
    document.body.style.setProperty("--color-bg", colors.bg);
    document.body.style.setProperty("--color-font", colors.font);
    document.body.style.setProperty("--color-key", colors.key);

    if (
      (name === "matrix" && !matrixAnim) ||
      (name !== "matrix" && matrixAnim)
    ) {
      toggleMatrix();
    }
  }

  const PROJECTS = [
    { url: "https://tablrr.app", label: "tablrr.app" },
    { url: "https://dinomatic.com", label: "DinoMatic" },
    { url: "https://learnmarkdown.com", label: "Learn Markdown" },
  ];

  const SECONDARY_COMMANDS = {
    copy: { article: "email", fn: copyEmail },
    "photo 2008": { article: "photo", fn: () => changePhoto(2008) },
    "photo 2015": { article: "photo", fn: () => changePhoto(2015) },
    "photo 2023": { article: "photo", fn: () => changePhoto(2023) },
    "photo 2026": { article: "photo", fn: () => changePhoto(2026) },
    open: {
      article: "source",
      fn: () => openLink("https://github.com/levonium/levon.dev"),
    },
    open: {
      article: "telegram",
      fn: () => openLink("https://t.me/levondev"),
    },
    read: { article: "posts", fn: () => openLink("https://quarks.levon.dev") },
    "theme light": { article: "settings", fn: () => changeTheme("light") },
    "theme dark": { article: "settings", fn: () => changeTheme("dark") },
    "theme matrix": { article: "settings", fn: () => changeTheme("matrix") },
    clock: { article: "settings", fn: toggleClock },
    wobble: { article: "settings", fn: toggleWobble },
    beep: { article: "settings", fn: beep },
  };

  PROJECTS.forEach((p, i) => {
    SECONDARY_COMMANDS[`project ${i + 1}`] = {
      article: "projects",
      fn: () => openLink(p.url),
    };
  });

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

  // Editor: press i to enter insert mode
  document.addEventListener("keyup", (e) => {
    if (e.key === "i" && state.shouldStartEditor && !editor.isContentEditable) {
      editor.contentEditable = "true";
      show(editorLabel);
      editor.focus();
      toggleEditorCaret();
      show(modeSpan);
      toggleErrorSpan();
      hide(banner);
      closePopup();
    }
  });

  // Editor: Escape to exit insert mode
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      editor.contentEditable = "false";
      toggleEditorCaret();
      show(banner);
      exitCommandMode();
    }
  });

  // Global: : for command mode, Escape to close popup
  document.addEventListener("keydown", (e) => {
    if (e.key === ":") {
      state.shouldStartEditor = false;
      toggleStatusBar();
      listenToKeyEvents();
    } else if (e.key === "Escape") {
      closePopup();
      document.getElementById("start-menu")?.classList.add("hidden");
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
})();
