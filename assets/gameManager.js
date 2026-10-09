import { $, show, hide } from "./utils.js";
import {
  startTetris,
  pauseTetris,
  togglePause,
  resetTetris,
  stopTetris,
  handleTetrisKey,
} from "./tetris.js";

export const GAMES = {
  tetris: {
    id: "tetris",
    name: "Tetris",
    desc: "The classic 1984 tile-matching puzzle game.",
    available: true,
    start: startTetris,
    pause: pauseTetris,
    togglePause: togglePause,
    restart: resetTetris,
    stop: stopTetris,
    handleKey: handleTetrisKey,
  },
};

let activeGameName = null;
let stateChangeCallback = null;

export function onGameStateChange(cb) {
  stateChangeCallback = cb;
}

export function getActiveGameName() {
  return activeGameName;
}

export function getActiveGame() {
  return activeGameName ? GAMES[activeGameName] : null;
}

export function launchGame(name) {
  const game = GAMES[name];
  if (!game || !game.available) return;

  activeGameName = name;

  const menuEl = $("#games-menu");
  const viewportEl = $("#games-viewport");
  if (menuEl) hide(menuEl);
  if (viewportEl) show(viewportEl);

  const headingEl = document.querySelector(".games-header-title");
  if (headingEl) headingEl.textContent = game.name;

  const titleEl = document.querySelector(".popup .titlebar .title");
  if (titleEl) titleEl.textContent = game.name;

  game.start();

  if (stateChangeCallback) stateChangeCallback(name);
}

export function returnToGamesMenu() {
  if (activeGameName && GAMES[activeGameName]) {
    GAMES[activeGameName].stop();
  }
  activeGameName = null;

  const menuEl = $("#games-menu");
  const viewportEl = $("#games-viewport");
  if (viewportEl) hide(viewportEl);
  if (menuEl) show(menuEl);

  const headingEl = document.querySelector(".games-header-title");
  if (headingEl) headingEl.textContent = "Games";

  const titleEl = document.querySelector(".popup .titlebar .title");
  if (titleEl) titleEl.textContent = "Games";

  if (stateChangeCallback) stateChangeCallback(null);
}

export function pauseActiveGame() {
  const game = getActiveGame();
  if (game?.pause) game.pause();
}

export function stopActiveGame() {
  const game = getActiveGame();
  if (game?.stop) game.stop();
  activeGameName = null;

  const menuEl = $("#games-menu");
  const viewportEl = $("#games-viewport");
  if (viewportEl) hide(viewportEl);
  if (menuEl) show(menuEl);

  const headingEl = document.querySelector(".games-header-title");
  if (headingEl) headingEl.textContent = "Games";

  const titleEl = document.querySelector(".popup .titlebar .title");
  if (titleEl) titleEl.textContent = "Games";
}

export function handleActiveGameKey(e) {
  const game = getActiveGame();
  if (game?.handleKey) {
    return game.handleKey(e);
  }
  return false;
}
