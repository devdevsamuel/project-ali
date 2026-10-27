import test from 'node:test';
import assert from 'node:assert/strict';

// Headless browser stand-ins, installed before the dynamic imports.
class FakeContext {
  constructor() {
    this.globalAlpha = 1;
    this.fillStyle = '';
    this.imageSmoothingEnabled = false;
  }

  setTransform() {}
  translate() {}
  save() {}
  restore() {}
  clearRect() {}
  fillRect() {}
  drawImage() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }

  createRadialGradient() {
    return { addColorStop() {} };
  }
}

function createCanvas() {
  return {
    width: 960,
    height: 540,
    getContext: () => new FakeContext(),
    getBoundingClientRect: () => ({ width: 960, height: 540 }),
  };
}

class FakeAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.volume = 1;
    this.loop = false;
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(handler);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false }),
  devicePixelRatio: 1,
};
globalThis.document = {
  createElement: () => createCanvas(),
  addEventListener() {},
};
globalThis.HTMLElement = class HTMLElement {};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.Audio = FakeAudio;

let randomSeed = 424242;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { Game } = await import('../src/game/Game.js');
const { Input } = await import('../src/game/Input.js');
const { OUTRO_STEP_END, OUTRO_KISS_END, CRYSTAL_COUNT } = await import('../src/game/config.js');

function createGame() {
  const game = new Game(createCanvas(), {
    onNotice: () => {},
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: () => {},
    onKickCountChange: () => {},
  });
  game.audio.unlock();
  return game;
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

// Fast path to the couple phase: walk each crystal onto the runner, then run
// until the reunion has played out on its own.
function reachCouple(game) {
  game.start();
  game.spawnDistance = 1e9;
  for (let index = 0; index < CRYSTAL_COUNT; index += 1) {
    const entry = game.crystals.entries.find((candidate) => !candidate.collected);
    entry.distance = game.distance;
    entry.height = 52;
    stepFrames(game, 4);
  }
  let guard = 0;
  while (!(game.state === 'running' && game.couple) && guard < 6000) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'running');
  assert.equal(game.couple, true, 'the couple phase was reached');
}

test('solo mode: X still performs a kick', () => {
  const game = createGame();
  game.start();
  game.handleKick();
  assert.equal(game.player.state, 'kick', 'the solo kick still works');
  assert.equal(game.state, 'running');
  stepFrames(game, 40);
  assert.equal(game.player.state, 'run', 'the kick recovers into the run');
});

test('couple mode: X starts a kiss and never the solo kick', () => {
  const game = createGame();
  reachCouple(game);

  game.handleKick();
  assert.equal(game.state, 'couplekiss', 'the kiss scene takes over');
  assert.notEqual(game.player.state, 'kick', 'the solo kick system never runs');
  assert.ok(game.coupleKiss, 'the scene object exists');
  stepFrames(game, 2);
  assert.equal(game.player.state, 'kiss', 'he leans into the kiss pose');
  assert.equal(game.girl.state, 'kiss', 'she leans in too');

  // The world freezes exactly like the reunion scene.
  const distance = game.distance;
  const scroll = game.scroll;
  const playerX = game.player.x;
  const girlX = game.girl.x;
  stepFrames(game, 30);
  assert.equal(game.distance, distance, 'the run does not advance');
  assert.equal(game.scroll, scroll, 'the world does not scroll');
  assert.equal(game.player.x, playerX, 'he stops in his current position');
  assert.equal(game.girl.x, girlX, 'she stops in her current position');
  assert.equal(game.player.state, 'kiss');
  assert.ok(game.player.kissT > 0, 'the kiss animation is running');
  game.render(); // the mirrored facing must draw without errors
});

test('couple mode: X cannot start a second kiss while one plays', () => {
  const game = createGame();
  reachCouple(game);

  game.handleKick();
  const scene = game.coupleKiss;
  for (let index = 0; index < 8; index += 1) {
    game.handleKick(); // hammering the key mid-animation
    stepFrames(game, 3);
  }
  assert.equal(game.coupleKiss, scene, 'the same scene keeps playing');
  assert.equal(game.state, 'couplekiss');
  assert.ok(scene.t > 0.3, 'time kept flowing from the first press only');
});

test('couple mode: the run resumes cleanly when the kiss ends', () => {
  const game = createGame();
  reachCouple(game);
  const distance = game.distance;
  const playerX = game.player.x;
  const girlX = game.girl.x;
  const music = game.audio.music;

  game.handleKick();
  stepFrames(game, 60); // mid-kiss
  assert.equal(game.distance, distance, 'the world stays frozen during the kiss');

  // Let the kiss run to the end; the run resumes from the same progress.
  let guard = 0;
  while (game.state === 'couplekiss' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'running', 'the couple run resumes');
  assert.equal(game.distance, distance, 'no progress gained or lost by the kiss');
  assert.equal(game.coupleKiss, null, 'the scene is cleared');
  assert.equal(game.player.state, 'together', 'he is back in the shared run');
  assert.equal(game.girl.state, 'together', 'she is back in the shared run');
  assert.equal(game.player.kissT, 0);
  assert.equal(game.girl.kissT, 0);
  assert.equal(game.player.x, playerX, 'no teleporting');
  assert.equal(game.girl.x, girlX, 'no teleporting');
  assert.equal(game.audio.music, music, 'the music is untouched by the kiss');

  // Running, jumping and the shared double jump all still work.
  stepFrames(game, 5);
  assert.ok(game.distance > distance, 'the run continues');
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 1, 'jumping still works');
  stepFrames(game, 8);
  assert.equal(game.girl.jumpsUsed, 1, 'her shared jump still answers');
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 2, 'the double jump still works');
});

test('couple mode: a fresh press after the kiss starts the next one', () => {
  const game = createGame();
  reachCouple(game);

  game.handleKick();
  stepFrames(game, Math.ceil((OUTRO_KISS_END + 0.3) * 60));
  assert.equal(game.state, 'running');

  game.handleKick();
  assert.equal(game.state, 'couplekiss', 'a new press triggers exactly one new kiss');
  stepFrames(game, 2);
  assert.equal(game.player.state, 'kiss');
  stepFrames(game, Math.ceil((OUTRO_KISS_END + 0.3) * 60));
  assert.equal(game.state, 'running', 'and it finishes cleanly again');
});

test('the kick key only fires on a fresh press, never while held', () => {
  let kicks = 0;
  const input = new Input({
    onJump: () => {},
    onPause: () => {},
    onKick: () => {
      kicks += 1;
    },
    onAdvance: () => {},
  });
  const press = (repeat) => input.handleKeyDown({
    code: 'KeyX', repeat, target: null, preventDefault() {},
  });

  press(false); // first press
  press(true); // auto-repeat while the key is held
  press(true);
  press(true);
  assert.equal(kicks, 1, 'holding X fires exactly once');

  input.handleKeyUp({ code: 'KeyX' });
  press(false); // released and pressed again
  assert.equal(kicks, 2, 'a new press after release fires again');
});

test('the reunion dialogue and its original kiss are untouched', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  for (let index = 0; index < CRYSTAL_COUNT; index += 1) {
    const entry = game.crystals.entries.find((candidate) => !candidate.collected);
    entry.distance = game.distance;
    entry.height = 52;
    stepFrames(game, 4);
  }
  let guard = 0;
  while (!(game.state === 'reunion') && guard < 600) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'reunion');
  guard = 0;
  while (!(game.reunion && game.reunion.phase === 'dialogue') && guard < 400) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.reunion.phase, 'dialogue', 'the dialogue still begins');
  // X keeps advancing the conversation exactly as before.
  const beat = game.reunion.beatIndex;
  stepFrames(game, 90); // let the first line finish typing
  game.handleKick();
  stepFrames(game, 2);
  assert.equal(game.reunion.beatIndex, beat + 1, 'X still advances the reunion dialogue');
});
