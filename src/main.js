import './style.css';
import { Game } from './game/Game.js';

const elements = {
  canvas: document.querySelector('#gameCanvas'),
  distance: document.querySelector('#distance'),
  hearts: document.querySelector('#hearts'),
  crystals: document.querySelector('#crystals'),
  money: document.querySelector('#money'),
  kickCount: document.querySelector('#kickCount'),
  finalDistance: document.querySelector('#finalDistance'),
  startScreen: document.querySelector('#startScreen'),
  pauseScreen: document.querySelector('#pauseScreen'),
  gameOverScreen: document.querySelector('#gameOverScreen'),
  startButton: document.querySelector('#startButton'),
  pauseButton: document.querySelector('#pauseButton'),
  resumeButton: document.querySelector('#resumeButton'),
  restartButton: document.querySelector('#restartButton'),
  jumpButton: document.querySelector('#jumpButton'),
  kickButton: document.querySelector('#kickButton'),
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
  elements.pauseButton.disabled = state !== 'running' && state !== 'paused';
  elements.pauseButton.textContent = state === 'paused' ? 'Resume' : 'Pause';

  // During the reunion the jump button doubles as the dialogue advance.
  const inReunion = state === 'reunion';
  elements.jumpButton.disabled = state !== 'running' && !inReunion;
  elements.jumpButton.innerHTML = inReunion
    ? 'Continue <span aria-hidden="true">▸</span>'
    : 'Jump <span aria-hidden="true">↑</span>';
  elements.jumpButton.setAttribute('aria-label', inReunion ? 'Continue the conversation' : 'Jump');

  // The kick belongs to the solo stage only.
  elements.kickButton.disabled = !(state === 'running' && !game.couple);

  if (state === 'gameover') {
    elements.finalDistance.textContent = `${Math.floor(game.distance)} m`;
    elements.status.textContent = `Run over at ${Math.floor(game.distance)} meters.`;
  } else if (state === 'paused') {
    elements.status.textContent = 'Game paused.';
  } else if (state === 'running') {
    elements.status.textContent = game.couple
      ? 'Game running with both characters.'
      : 'Game running.';
  } else if (state === 'reunion') {
    elements.status.textContent = 'The two characters meet. Press Continue to advance the dialogue.';
  }
}

const game = new Game(elements.canvas, {
  onStateChange: updateScreen,
  onDistanceChange: (distance) => {
    elements.distance.textContent = `${distance} m`;
  },
  onHeartsChange: (hearts) => {
    elements.hearts.textContent = `${hearts}`;
  },
  onCrystalsChange: (count) => {
    elements.crystals.textContent = `${count}/4`;
  },
  onMoneyChange: (money) => {
    // The balance turns red once the thief has taken the money.
    elements.money.textContent = money < 0 ? `-$${Math.abs(money)}` : `$${money}`;
    elements.money.classList.toggle('is-debt', money < 0);
  },
  onKickCountChange: (count) => {
    elements.kickCount.textContent = `${count}`;
  },
  onNotice: showToast,
});

// Handy for quick visual checks: ?autostart skips the menu, ?demo also plays.
const params = new URLSearchParams(window.location.search);
if (params.has('demo')) {
  game.autopilot = true;
  game.start();
} else if (params.has('autostart')) {
  game.start();
}

// ?crystals=4 pre-collects crystals so the reunion and the city can be
// inspected without playing the whole solo section first.
const preCollect = Number.parseInt(params.get('crystals') ?? '', 10);
if (Number.isInteger(preCollect) && preCollect > 0) {
  if (game.state === 'start') {
    game.start();
  }
  const total = Math.min(preCollect, 4);
  for (let index = 0; index < total; index += 1) {
    if (game.crystals.collect(game.crystals.entries[index])) {
      elements.crystals.textContent = `${game.crystals.collected}/4`;
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
