import { $, hide, copyEmail, openLink } from "./utils.js";
import { changeTheme, toggleClock, toggleWobble, beep } from "./effects.js";
import { launchGame, returnToGamesMenu, getActiveGame } from "./gameManager.js";

export const LEGAL_COMMANDS = [
  "q",
  "help",
  "settings",
  "email",
  "telegram",
  "games",
  "photo",
  "source",
  "posts",
  "projects",
  "privacy",
  "terms",
];

export const NAV_SECTIONS = LEGAL_COMMANDS.filter(
  (c) => c !== "q" && c !== "help" && c !== "settings",
);

export const QUIT_COMMANDS = {
  yes: {
    fn: () =>
      alert(
        "Sorry, I can't close the browser tab, you'll have to do it yourself. Bye.",
      ),
  },
  no: {
    fn: () => hide($(".status-bar--q")),
  },
};

export const LETTER_KEYS = {
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

export const PROJECTS = [
  { url: "https://tablrr.app", label: "tablrr.app" },
  { url: "https://affkraft.com", label: "AffKraft.com" },
  { url: "https://learnmarkdown.com", label: "Learn Markdown" },
];

let currentPhotoYear = 2008;

export function changePhoto(year) {
  currentPhotoYear = year;
  const img = $("#levon");
  if (!img) return;
  img.src = `assets/levon-${year}.jpg`;
  img.style.filter = "unset";

  document.querySelectorAll(".popup [data-photo-year]").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.photoYear) === year);
  });
}

export const SECONDARY_COMMANDS = [
  { name: "copy", article: "email", fn: copyEmail },
  { name: "photo 2008", article: "photo", fn: () => changePhoto(2008) },
  { name: "photo 2015", article: "photo", fn: () => changePhoto(2015) },
  { name: "photo 2023", article: "photo", fn: () => changePhoto(2023) },
  { name: "photo 2026", article: "photo", fn: () => changePhoto(2026) },
  {
    name: "open",
    article: "source",
    fn: () => openLink("https://github.com/levonium/levon.dev"),
  },
  {
    name: "chat",
    article: "telegram",
    fn: () => openLink("https://t.me/levondev"),
  },
  { name: "read", article: "posts", fn: () => openLink("https://quarks.levon.dev") },
  { name: "theme light", article: "settings", fn: () => changeTheme("light") },
  { name: "theme dark", article: "settings", fn: () => changeTheme("dark") },
  { name: "theme matrix", article: "settings", fn: () => changeTheme("matrix") },
  { name: "clock", article: "settings", fn: toggleClock },
  { name: "wobble", article: "settings", fn: toggleWobble },
  { name: "beep", article: "settings", fn: beep },
  {
    name: "tetris",
    article: "games",
    inGame: false,
    fn: () => launchGame("tetris"),
  },
  {
    name: "snake",
    article: "games",
    inGame: false,
    fn: () => launchGame("snake"),
  },
  {
    name: "mines",
    article: "games",
    inGame: false,
    fn: () => launchGame("mines"),
  },
  {
    name: "minesweeper",
    article: "games",
    inGame: false,
    fn: () => launchGame("mines"),
  },
  {
    name: "pause",
    article: "games",
    inGame: true,
    fn: () => getActiveGame()?.togglePause(),
  },
  {
    name: "restart",
    article: "games",
    inGame: true,
    fn: () => getActiveGame()?.restart(),
  },
  {
    name: "menu",
    article: "games",
    inGame: true,
    fn: () => returnToGamesMenu(),
  },
];

PROJECTS.forEach((p, i) => {
  SECONDARY_COMMANDS.push({
    name: `project ${i + 1}`,
    article: "projects",
    fn: () => openLink(p.url),
  });
});
