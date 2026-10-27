import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

let randomSeed = 515050;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { Game } = await import('../src/game/Game.js');
const {
  CRYSTAL_COUNT, KISSES_REQUIRED_FOR_BABY, KISS_INSTRUCTION_DELAY, KISS_INSTRUCTION_HOLD,
  KISS_INSTRUCTION_FADE, KISS_INSTRUCTION_TEXT, OUTRO_KISS_END,
} = await import('../src/game/config.js');
const { hasGlyph } = await import('../src/game/font.js');

function createGame(hooks = {}) {
  const game = new Game(createCanvas(), {
    onNotice: hooks.onNotice ?? (() => {}),
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: () => {},
    onKickCountChange: () => {},
    onKissCountChange: hooks.onKissCountChange ?? (() => {}),
  });
  game.audio.unlock();
  return game;
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

// Walk the required crystals onto the runner, then run until the reunion has
// played out and the couple phase begins. Random spawns are muted so the
// scripted assertions stay deterministic.
function reachCouple(game) {
  game.start();
  game.spawnDistance = 1e9;
  game.robberTimer = 1e9;
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
  game.spawnDistance = 1e9;
  game.robberTimer = 1e9;
}

function runOneKiss(game) {
  game.handleKick();
  let guard = 0;
  while (game.state === 'couplekiss' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'running', 'the kiss finished');
}

test('the reunion needs all five crystals, and only once per run', () => {
  const notices = [];
  const game = createGame({ onNotice: (message) => notices.push(message) });
  game.start();
  game.spawnDistance = 1e9;
  game.robberTimer = 1e9;

  // Four crystals: nothing happens yet.
  for (let index = 0; index < 4; index += 1) {
    const entry = game.crystals.entries.find((candidate) => !candidate.collected);
    entry.distance = game.distance;
    entry.height = 52;
    stepFrames(game, 4);
  }
  assert.equal(game.crystals.collected, 4);
  assert.equal(game.crystals.complete, false, 'four crystals are not enough');
  stepFrames(game, 90);
  assert.equal(game.girl.active, false, 'she does not appear after four');
  assert.equal(game.state, 'running', 'no reunion after four crystals');

  // The fifth one completes the set.
  const fifth = game.crystals.entries.find((candidate) => !candidate.collected);
  fifth.distance = game.distance;
  fifth.height = 52;
  stepFrames(game, 4);
  assert.equal(game.crystals.collected, CRYSTAL_COUNT, 'the counter stops at five');
  assert.equal(game.crystals.complete, true);
  assert.equal(game.girl.active, true, 'she appears after the fifth');
  assert.ok(notices.some((notice) => /cinco cristales/i.test(notice)));

  // The counter can never exceed the total.
  for (const entry of game.crystals.entries) {
    game.crystals.collect(entry);
  }
  assert.equal(game.crystals.collected, CRYSTAL_COUNT, 'no sixth crystal');

  // The reunion starts once, plays out, and cannot fire again.
  let guard = 0;
  while (game.state !== 'reunion' && guard < 400) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'reunion');
  guard = 0;
  while (!(game.state === 'running' && game.couple) && guard < 6000) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.couple, true);
  game.spawnDistance = 1e9; // keep the closing soak-step free of new hazards
  stepFrames(game, 240);
  assert.equal(game.reunion, null, 'the reunion stays finished');
  assert.notEqual(game.girl.mode, 'wait', 'she never waits a second time');
  assert.equal(game.state, 'running');
});

test('the kiss counter starts at 0/4 and counts completed kisses once', () => {
  const counts = [];
  const game = createGame({ onKissCountChange: (count) => counts.push(count) });
  reachCouple(game);
  assert.equal(game.kisses, 0, 'the counter starts at zero');
  assert.equal(counts[counts.length - 1], 0, 'the UI is told about the start value');

  // One kiss, with X hammered the whole time: still exactly one count.
  game.handleKick();
  for (let index = 0; index < 10; index += 1) {
    game.handleKick();
  }
  assert.equal(game.kisses, 0, 'a key press alone counts nothing');
  let guard = 0;
  while (game.state === 'couplekiss' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.kisses, 1, 'the completed kiss counts exactly once');
  assert.equal(counts[counts.length - 1], 1, 'the UI is updated');
  assert.equal(counts.filter((count) => count === 1).length, 1, 'reported exactly once');

  runOneKiss(game);
  assert.equal(game.kisses, 2, 'each completed kiss adds exactly one');
  assert.equal(counts[counts.length - 1], 2);
});

test('the instruction sign appears two seconds into the couple run, once', () => {
  const game = createGame();
  reachCouple(game);
  assert.ok(game.coupleHint, 'the sign is scheduled when the run begins');
  stepFrames(game, Math.ceil((KISS_INSTRUCTION_DELAY - 0.2) * 60));
  assert.ok(game.coupleHint.t < KISS_INSTRUCTION_DELAY, 'not shown before two seconds');
  stepFrames(game, Math.ceil(0.4 * 60));
  assert.ok(game.coupleHint.t >= KISS_INSTRUCTION_DELAY, 'shown after two seconds');
  game.render(); // the sign must draw cleanly over the running scene

  stepFrames(game, Math.ceil((KISS_INSTRUCTION_HOLD + KISS_INSTRUCTION_FADE + 0.6) * 60));
  assert.equal(game.coupleHint, null, 'it fades out and does not come back');
  stepFrames(game, 120);
  assert.equal(game.coupleHint, null, 'shown only once per run');
});

test('the exact instruction wording is configured and renderable', () => {
  assert.equal(
    KISS_INSTRUCTION_TEXT,
    'Ahora oprime X para más besitos, llega a 4 para conocer a nuestro bebé ;)',
  );
  // The counter, HUD and unlock condition share one threshold.
  assert.equal(KISSES_REQUIRED_FOR_BABY, 4);
  for (const character of Array.from(KISS_INSTRUCTION_TEXT)) {
    if (character === ' ') {
      continue;
    }
    assert.ok(hasGlyph(character), `missing glyph for "${character}"`);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /Besitos: <strong id="kisses">0\/4<\/strong>/, 'the HUD shows Besitos: 0/4');
});

test('the baby arrives exactly at 4/4, joins the run and unlocks the triple jump', () => {
  const game = createGame();
  reachCouple(game);

  // Before the baby: only two jumps exist.
  assert.equal(game.player.maxJumps, 2, 'double jump before the baby');
  game.handleJump();
  stepFrames(game, 3);
  game.handleJump();
  stepFrames(game, 3);
  game.handleJump();
  stepFrames(game, 3);
  assert.equal(game.player.jumpsUsed, 2, 'the third jump does not exist yet');
  let landing = 0;
  while (!game.player.grounded && landing < 300) {
    game.advance(1 / 60);
    landing += 1;
  }
  assert.equal(game.player.jumpsUsed, 0, 'landing resets the jump counter');

  // Three kisses: no baby yet.
  for (let index = 0; index < 3; index += 1) {
    runOneKiss(game);
  }
  assert.equal(game.kisses, 3);
  assert.equal(game.baby, null, 'no baby before 4/4');
  assert.equal(game.player.maxJumps, 2);

  // The fourth brings the baby in.
  runOneKiss(game);
  assert.equal(game.kisses, 4, 'the counter reaches 4/4');
  assert.ok(game.baby, 'the baby spawns exactly at 4/4');
  assert.equal(game.babyRevealed, true);
  assert.equal(game.player.maxJumps, 3, 'triple jump unlocked');
  assert.equal(game.girl.maxJumps, 3, 'for both runners');

  // The baby joins the running group.
  let joining = 0;
  while (game.baby.state !== 'run' && joining < 120) {
    game.advance(1 / 60);
    joining += 1;
  }
  assert.equal(game.baby.state, 'run', 'the baby settles into the group');
  assert.equal(game.baby.x, game.baby.targetX);

  // Kissing on does not spawn a second baby, and progress is untouched.
  const distanceBefore = game.distance;
  const musicBefore = game.audio.music;
  runOneKiss(game);
  assert.equal(game.kisses, 5);
  assert.equal(game.babyRevealed, true, 'the reveal happens only once');
  assert.ok(game.distance >= distanceBefore, 'the crystal count and progress are kept');
  assert.equal(game.audio.music, musicBefore, 'the music is untouched');

  // The triple jump works for the whole family. Eight frames between presses
  // give her queued answer time to land before the next request.
  game.handleJump();
  stepFrames(game, 8);
  assert.equal(game.player.jumpsUsed, 1);
  game.handleJump();
  stepFrames(game, 8);
  assert.equal(game.player.jumpsUsed, 2);
  game.handleJump();
  stepFrames(game, 8);
  assert.equal(game.player.jumpsUsed, 3, 'the third jump is available');
  stepFrames(game, 14);
  assert.equal(game.girl.jumpsUsed, 3, 'she answers all three jumps');
  game.render();

  landing = 0;
  while (!game.player.grounded && landing < 400) {
    game.advance(1 / 60);
    landing += 1;
  }
  assert.equal(game.player.jumpsUsed, 0, 'landing resets the triple jump');
  assert.ok(game.distance > distanceBefore, 'the run keeps its progress');
  assert.equal(game.state, 'running');
});
