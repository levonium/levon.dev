import { $, show, hide } from "./utils.js";
import {
  startTetris,
  pauseTetris,
  togglePause as toggleTetrisPause,
  resetTetris,
  stopTetris,
  handleTetrisKey,
} from "./tetris.js";
import {
  startSnake,
  pauseSnake,
  togglePause as toggleSnakePause,
  resetSnake,
  stopSnake,
  handleSnakeKey,
} from "./snake.js";

export const GAMES = {
  tetris: {
    id: "tetris",
    name: "Tetris",
    desc: "The classic 1984 tile-matching puzzle game.",
    available: true,
    start: startTetris,
    pause: pauseTetris,
    togglePause: toggleTetrisPause,
    restart: resetTetris,
    stop: stopTetris,
    handleKey: handleTetrisKey,
  },
  snake: {
    id: "snake",
    name: "Snake",
    desc: "Classic terminal snake with Vim navigation.",
    available: true,
    start: startSnake,
    pause: pauseSnake,
    togglePause: toggleSnakePause,
    restart: resetSnake,
    stop: stopSnake,
    handleKey: handleSnakeKey,
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

  document.querySelectorAll(".game-view").forEach((v) => hide(v));
  const activeView = $(`#game-view-${name}`);
  if (activeView) show(activeView);

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

  document.querySelectorAll(".game-view").forEach((v) => hide(v));
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
