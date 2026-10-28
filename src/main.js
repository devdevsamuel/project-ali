import './style.css';
import { Game } from './game/Game.js';
import { KISSES_REQUIRED_FOR_BABY, CRYSTAL_COUNT } from './game/config.js';

const elements = {
  canvas: document.querySelector('#gameCanvas'),
  distance: document.querySelector('#distance'),
  crystals: document.querySelector('#crystals'),
  kissesChip: document.querySelector('#kissesChip'),
  kisses: document.querySelector('#kisses'),
  livesChip: document.querySelector('#livesChip'),
  lives: document.querySelector('#lives'),
  finalDistance: document.querySelector('#finalDistance'),
  startScreen: document.querySelector('#startScreen'),
  pauseScreen: document.querySelector('#pauseScreen'),
  gameOverScreen: document.querySelector('#gameOverScreen'),
  endingScreen: document.querySelector('#endingScreen'),
  startButton: document.querySelector('#startButton'),
  pauseButton: document.querySelector('#pauseButton'),
  resumeButton: document.querySelector('#resumeButton'),
  restartButton: document.querySelector('#restartButton'),
  endingRestartButton: document.querySelector('#endingRestartButton'),
  jumpButton: document.querySelector('#jumpButton'),
  kickButton: document.querySelector('#kickButton'),
  musicButton: document.querySelector('#musicButton'),
  status: document.querySelector('#gameStatus'),
  toast: document.querySelector('#toast'),
};

let toastTimer = 0;

// Short-lived hint shown only on real events, never inside the game loop.
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  elements.status.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function updateScreen(state) {
  elements.startScreen.hidden = state !== 'start';
  elements.pauseScreen.hidden = state !== 'paused';
  elements.gameOverScreen.hidden = state !== 'gameover';
  // The secret ending replaces the ordinary game-over screen entirely.
  elements.endingScreen.hidden = state !== 'ending';
  elements.pauseButton.disabled = state !== 'running' && state !== 'paused';
  elements.pauseButton.textContent = state === 'paused' ? 'Reanudar' : 'Pausa';

  // During the reunion the jump button doubles as the dialogue advance.
  const inReunion = state === 'reunion';
  elements.jumpButton.disabled = state !== 'running' && !inReunion;
  elements.jumpButton.innerHTML = inReunion
    ? 'Continuar <span aria-hidden="true">▸</span>'
    : 'Saltar <span aria-hidden="true">↑</span>';
  elements.jumpButton.setAttribute('aria-label', inReunion ? 'Continuar la conversación' : 'Saltar');

  // The kick belongs to the solo stage only.
  elements.kickButton.disabled = !(state === 'running' && !game.couple);

  // The kisses counter only exists once the couple is actually running
  // together; it stays hidden in the menu, the solo stage, the reunion and
  // every terminal state. Use the couple flag (not the running state) so it
  // stays visible while paused, matching the life chip's behaviour.
  elements.kissesChip.hidden = !game.couple;

  if (state === 'gameover') {
    elements.finalDistance.textContent = `${Math.floor(game.distance)} m`;
    elements.status.textContent = `Fin de la carrera en ${Math.floor(game.distance)} metros.`;
  } else if (state === 'paused') {
    elements.status.textContent = 'Juego en pausa.';
  } else if (state === 'running') {
    elements.status.textContent = game.couple
      ? 'Juego en marcha con ambos personajes.'
      : 'Juego en marcha.';
  } else if (state === 'reunion') {
    elements.status.textContent = 'Los personajes se encuentran. Pulsa Continuar para avanzar el diálogo.';
  } else if (state === 'ending') {
    elements.status.textContent = 'Final secreto: Continuará...';
  }
}

// The music button mirrors the audio manager's real state: the label shows
// what the next press does, and the muted style follows the actual preference.
function updateMusicButton(state) {
  const muted = !state.enabled;
  elements.musicButton.textContent = muted ? '♪ Reanudar' : '♪ Pausar';
  elements.musicButton.setAttribute('aria-label', muted ? 'Reanudar música' : 'Pausar música');
  elements.musicButton.setAttribute('aria-pressed', String(muted));
  elements.musicButton.classList.toggle('is-muted', muted);
  elements.musicButton.classList.toggle('is-playing', state.playing);
}

const game = new Game(elements.canvas, {
  onStateChange: updateScreen,
  onDistanceChange: (distance) => {
    elements.distance.textContent = `${distance} m`;
  },
  onCrystalsChange: (count) => {
    elements.crystals.textContent = `${count}/${CRYSTAL_COUNT}`;
  },
  onKissCountChange: (count) => {
    // The counter reads x/KISSES_REQUIRED_FOR_BABY; extra kisses after the
    // baby stay capped on screen.
    elements.kisses.textContent = `${Math.min(count, KISSES_REQUIRED_FOR_BABY)}/${KISSES_REQUIRED_FOR_BABY}`;
  },
  onLivesChange: (lives) => {
    // One heart per living family member; the chip only exists while the
    // couple-stage life system is running (never confused with pickups).
    elements.lives.textContent = '♥'.repeat(Math.max(0, lives));
    elements.livesChip.hidden = lives <= 0;
  },
  onNotice: showToast,
});

// Music pause/resume: the button asks the audio manager to toggle, and the
// manager reports every real playback change back so the label never drifts
// from what is actually audible. It only touches the background songs.
game.audio.onMusicChange = updateMusicButton;
updateMusicButton(game.audio.musicState());
elements.musicButton.addEventListener('click', () => {
  game.audio.toggleMusic();
});

// Handy for quick visual checks: ?autostart skips the menu, ?demo also plays.
const params = new URLSearchParams(window.location.search);
if (params.has('demo')) {
  game.autopilot = true;
  game.start();
} else if (params.has('autostart')) {
  game.start();
}

// ?crystals=5 pre-collects every crystal so the reunion and the city can be
// inspected without playing the whole solo section first.
const preCollect = Number.parseInt(params.get('crystals') ?? '', 10);
if (Number.isInteger(preCollect) && preCollect > 0) {
  if (game.state === 'start') {
    game.start();
  }
  const total = Math.min(preCollect, CRYSTAL_COUNT);
  for (let index = 0; index < total; index += 1) {
    if (game.crystals.collect(game.crystals.entries[index])) {
      elements.crystals.textContent = `${game.crystals.collected}/${CRYSTAL_COUNT}`;
    }
  }
}

// ?distance=126 puts the runner on a given stretch of road, so a sign can be
// inspected without playing the whole way there.
const jumpTo = Number.parseFloat(params.get('distance'));
if (Number.isFinite(jumpTo) && jumpTo > 0) {
  if (game.state === 'start') {
    game.start();
  }
  game.spawnDistance = 1e9;
  game.hazards = [];
  game.distance = jumpTo;
  game.scroll = jumpTo * 50;
  game.girl.active = false;
  game.girl.mode = 'off';
}

// ?t=12 fast-forwards the simulation deterministically (visual verification).
const fastForward = Number.parseFloat(params.get('t'));
if (fastForward > 0) {
  for (let step = 0; step < fastForward * 60; step += 1) {
    game.advance(1 / 60);
  }
}

// ?kick=0.13 throws a kick at a rival so the impact can be inspected without
// having to fight for the timing.
if (params.has('kick')) {
  if (game.state === 'start') {
    game.start();
  }
  const { Rival } = await import('./game/Rival.js');
  const { GROUND_Y } = await import('./game/config.js');
  game.spawnDistance = 1e9;
  const rival = new Rival(game.player.x + 74, GROUND_Y, 'diva');
  game.hazards.push(rival);
  game.handleKick();
  const kickSteps = Number.parseFloat(params.get('kick')) || 0.12;
  for (let step = 0; step < kickSteps * 60; step += 1) {
    game.advance(1 / 60);
  }
}

// ?robbery=2.6 starts the theft encounter so it can be inspected directly.
if (params.has('robbery')) {
  if (game.state === 'start') {
    game.start();
  }
  game.spawnDistance = 1e9;
  game.robberTimer = 0;
  const robberySteps = Number.parseFloat(params.get('robbery')) || 3;
  for (let step = 0; step < robberySteps * 60; step += 1) {
    game.advance(1 / 60);
  }
}

// ?kicks=5 fakes five successful kicks so the celebration can be inspected.
if (params.has('kicks')) {
  const count = Number.parseInt(params.get('kicks'), 10) || 5;
  game.kickCount = 0;
  game.kickedHazards.clear();
  for (let index = 0; index < count; index += 1) {
    // A fresh token per kick, so each one counts.
    game.countKickSuccess({});
  }
}

// The inspection params hold their exact frame instead of resuming the loop.
if (params.has('kick') || params.has('robbery') || params.has('kicks')
  || params.has('distance') || fastForward > 0) {
  cancelAnimationFrame(game.animationFrame);
  game.render();
}

elements.startButton.addEventListener('click', () => game.start());
elements.restartButton.addEventListener('click', () => game.restart());
// The ending never restarts on its own; only this clearly labelled control
// starts a genuinely new run.
elements.endingRestartButton.addEventListener('click', () => game.start());
elements.pauseButton.addEventListener('click', () => game.togglePause());
elements.resumeButton.addEventListener('click', () => game.resume());

function bindActionButton(button, action) {
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    action();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) {
      action();
    }
  });
}

bindActionButton(elements.jumpButton, () => game.handleJump());
bindActionButton(elements.kickButton, () => game.handleKick());
// Tapping the screen advances the reunion dialogue on touch devices.
elements.canvas.addEventListener('pointerdown', () => {
  if (game.state === 'reunion') {
    game.handleAdvance();
  }
});

window.addEventListener('resize', () => game.resize());
window.addEventListener('blur', () => game.pause());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
  }
});

// Inspection handle: lets browser tooling (and curious players in the
// console) read the live state — the project already ships ?t=, ?kick= and
// friends for the same purpose. No secrets live here.
window.loveRunner = game;
