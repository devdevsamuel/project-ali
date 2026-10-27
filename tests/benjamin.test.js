import test from 'node:test';
import assert from 'node:assert/strict';

// Headless stand-ins for the browser, installed before the dynamic imports.
class FakeContext {
  constructor() {
    this.globalAlpha = 1;
    this.fillStyle = '';
    this.imageSmoothingEnabled = false;
    this.fills = [];
  }

  setTransform() {}
  translate() {}
  save() {}
  restore() {}
  clearRect() {}
  line() {}
  circle() {}
  glow() {}
  fillRect(x, y, w, h) {
    this.fills.push({ x, y, w, h, fill: this.fillStyle, alpha: this.globalAlpha });
  }

  // The real view snaps to the art grid and fills; the recorder keeps the
  // snapped rectangle so the tests can check what was painted.
  rect(x, y, w, h, color, alpha = 1) {
    const left = Math.round(x / 2);
    const top = Math.round(y / 2);
    const right = Math.round((x + w) / 2);
    const bottom = Math.round((y + h) / 2);
    if (right <= left || bottom <= top) {
      return;
    }
    this.fills.push({
      x: left, y: top, w: right - left, h: bottom - top, fill: color, alpha,
    });
  }
  drawImage() {}
  createLinearGradient() {
    return { addColorStop() {} };
  }

  createRadialGradient() {
    return { addColorStop() {} };
  }
}

function createCanvas() {
  const context = new FakeContext();
  return {
    width: 960,
    height: 540,
    getContext: () => context,
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

let randomSeed = 246810;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { Game } = await import('../src/game/Game.js');
const { Baby } = await import('../src/game/Baby.js');
const { Obstacle, COUPLE_VARIANTS } = await import('../src/game/Obstacle.js');
const {
  CRYSTAL_COUNT, KISSES_REQUIRED_FOR_BABY, ENABLE_DIALOGUE_VOICES,
  BABY_INTRO_DURATION, BABY_INTRO_FADE, BABY_INTRO_TEXT, GROUND_Y,
} = await import('../src/game/config.js');
const { hasGlyph } = await import('../src/game/font.js');
const { REUNION_BEATS } = await import('../src/game/dialogue.js');

function createGame(hooks = {}) {
  const game = new Game(createCanvas(), {
    onNotice: hooks.onNotice ?? (() => {}),
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: () => {},
    onKickCountChange: () => {},
    onKissCountChange: () => {},
    onLivesChange: () => {},
  });
  game.audio.unlock();
  return game;
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

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
  assert.equal(game.couple, true, 'the couple phase was reached');
  game.spawnDistance = 1e9;
  game.robberTimer = 1e9;
}

function joinBaby(game) {
  for (let index = 0; index < KISSES_REQUIRED_FOR_BABY; index += 1) {
    game.handleKick();
    let guard = 0;
    while (game.state === 'couplekiss' && guard < 300) {
      game.advance(1 / 60);
      guard += 1;
    }
  }
  assert.ok(game.baby, 'the baby arrives');
  let guard = 0;
  while (game.baby.state !== 'run' && guard < 240) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.baby.state, 'run', 'the arrival finished');
}

test('Benjamin runs at the speed of the road while he catches up', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);

  // He is glued to the family's slot: the road scrolls, the family stands
  // still, and so does Benjamin.
  const boyX = game.player.x;
  const girlX = game.girl.x;
  const babyX = game.baby.x;
  stepFrames(game, 120);
  assert.equal(game.player.x, boyX, 'Samuel holds his slot');
  assert.equal(game.girl.x, girlX, 'Ali holds her slot');
  assert.equal(game.baby.x, babyX, 'Benjamin holds his slot, no drifting');
  assert.equal(game.baby.x, game.player.x - 92, 'he stays in the family formation');
});

test("Benjamin's arrival runs at the speed of the road, not slower", () => {
  const game = createGame();
  reachCouple(game);
  // Kiss until the baby is created, then measure his catch-up speed.
  for (let index = 0; index < KISSES_REQUIRED_FOR_BABY; index += 1) {
    game.handleKick();
    let guard = 0;
    while (game.state === 'couplekiss' && guard < 300) {
      game.advance(1 / 60);
      guard += 1;
    }
  }
  assert.equal(game.baby.state, 'enter', 'he is still catching up');
  const startX = game.baby.x;
  const startDistance = game.distance;
  // Measure while he is still on the road: he travels at the speed of the
  // world, so he never looks slower than the street he is running on.
  stepFrames(game, 10);
  const travelled = game.baby.x - startX;
  const roadTravel = (game.distance - startDistance) * 50; // metres -> pixels
  assert.ok(travelled > 0, 'he moves forward while catching up');
  assert.ok(
    Math.abs(travelled - roadTravel) < 8,
    `he travels ${travelled.toFixed(1)} units while the road covers ${roadTravel.toFixed(1)}`,
  );
});

test('Benjamin jumps with the family and lands back on his feet', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  const groundY = game.baby.y + game.baby.height;

  game.handleJump();
  stepFrames(game, 6);
  assert.equal(game.baby.grounded, false, 'he leaves the ground with them');
  assert.ok(game.baby.y < groundY - 20, 'he really rises');
  assert.equal(game.baby.jumpsUsed, 1, 'his first jump is counted');

  // He comes back down and his feet return to the road.
  let guard = 0;
  while (!game.baby.grounded && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.baby.grounded, true, 'he lands');
  assert.equal(game.baby.y + game.baby.height, groundY, 'his feet are back on the ground');
  assert.equal(game.baby.jumpsUsed, 0, 'the counter resets on landing');
});

test('Benjamin can double jump, but never jumps a third time', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);

  game.handleJump();
  stepFrames(game, 6);
  assert.equal(game.baby.jumpsUsed, 1);
  game.handleJump();
  stepFrames(game, 6);
  assert.equal(game.baby.jumpsUsed, 2, 'his second jump works in mid-air');
  game.handleJump();
  stepFrames(game, 6);
  assert.equal(game.baby.jumpsUsed, 2, 'no third jump for the baby');

  let guard = 0;
  while (!game.baby.grounded && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.baby.jumpsUsed, 0, 'landing refills both jumps');
  assert.equal(game.baby.maxJumps, 2, 'he has exactly two jumps');
});

test("Samuel's and Ali's own jumping rules are unchanged", () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  assert.equal(game.player.maxJumps, 3, 'the family keeps its triple jump');
  assert.equal(game.girl.maxJumps, 3);

  game.handleJump();
  stepFrames(game, 4);
  assert.equal(game.player.jumpsUsed, 1);
  game.handleJump();
  stepFrames(game, 4);
  assert.equal(game.player.jumpsUsed, 2);
  game.handleJump();
  stepFrames(game, 4);
  assert.equal(game.player.jumpsUsed, 3, 'the third jump still works');

  // The baby's third jump never grants him a third jump of his own.
  assert.equal(game.baby.maxJumps, 2);
});

test('the Benjamin marker points at him and disappears after a few seconds', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);

  assert.ok(game.babyIntro, 'the marker appears once he has joined');
  assert.equal(game.babyIntroDone, false);
  assert.equal(BABY_INTRO_TEXT, 'Benjamin');
  for (const character of Array.from(BABY_INTRO_TEXT)) {
    if (character === ' ') {
      continue;
    }
    assert.ok(hasGlyph(character), `missing glyph for "${character}"`);
  }

  // It follows him: the marker uses his live position, so a jump moves it.
  const beforeY = game.baby.y;
  game.handleJump();
  stepFrames(game, 6);
  assert.ok(game.baby.y < beforeY, 'he is in the air');
  game.render(); // the marker must draw without errors while he jumps

  // It expires on its own and never comes back this run.
  stepFrames(game, Math.ceil((BABY_INTRO_DURATION + BABY_INTRO_FADE + 0.5) * 60));
  assert.equal(game.babyIntro, null, 'the marker is gone after its time');
  assert.equal(game.babyIntroDone, true, 'and it does not return during this run');
});

test('the marker is cleared on restart and on game over', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  assert.ok(game.babyIntro, 'the marker is running');

  game.start(); // a fresh run
  assert.equal(game.babyIntro, null, 'a restart clears the marker');
  assert.equal(game.babyIntroDone, false, 'a new run may show it again');

  reachCouple(game);
  joinBaby(game);
  assert.ok(game.babyIntro);
  // Each loss needs its own grace window to pass.
  for (let index = 0; index < 3; index += 1) {
    game.loseLife(400, 400);
    stepFrames(game, 60);
  }
  assert.equal(game.state, 'gameover');
  assert.equal(game.babyIntro, null, 'game over clears the marker');
});

test('couple-stage obstacles are visible, contrasted and in sync with their hitbox', () => {
  const game = createGame();
  reachCouple(game);
  game.spawnDistance = 0;
  stepFrames(game, 2);
  assert.ok(game.hazards.length > 0, 'the couple stage spawns props');

  const hazard = game.hazards[0];
  const bounds = hazard.getBounds();
  const recorder = game.view.contextBuffer;
  recorder.fills.length = 0;
  hazard.draw(recorder, 1.0);

  // The recorder keeps buffer pixels (the art grid), the hitbox is in game
  // units: compare them in the same space.
  const box = {
    x: bounds.x / 2,
    y: bounds.y / 2,
    width: bounds.width / 2,
    height: bounds.height / 2,
  };
  // Something is actually painted inside the hitbox: the player can see
  // exactly what can hurt them.
  const painted = recorder.fills.filter((fill) => (
    fill.x < box.x + box.width
    && fill.x + fill.w > box.x
    && fill.y < box.y + box.height
    && fill.y + fill.h > box.y
    && fill.alpha > 0
  ));
  assert.ok(painted.length > 0, 'the obstacle paints pixels inside its hitbox');

  // The palette is high contrast: a vivid amber body with a dark contour,
  // never the muted cream/terracotta that vanished into the white street.
  const colors = new Set(painted.map((fill) => fill.fill));
  assert.ok(colors.has('#FF8A1F'), `the vivid body colour is used (got ${[...colors].join(',')})`);
  assert.ok(colors.has('#2A0B3A'), 'the dark contour is used');
  assert.ok(!colors.has('#F3E9D6'), 'the old pale plank colour is gone');
  assert.ok(!colors.has('#C4693B'), 'the old muted terracotta is gone');
});

test('every couple obstacle type draws inside its own hitbox', () => {
  for (const pick of COUPLE_VARIANTS) {
    const obstacle = new Obstacle(300, GROUND_Y, pick.width, pick.height, pick.variant);
    const recorder = new FakeContext();
    obstacle.draw(recorder, 1.0);
    const bounds = obstacle.getBounds();
    const box = {
      x: bounds.x / 2,
      y: bounds.y / 2,
      width: bounds.width / 2,
      height: bounds.height / 2,
    };
    const painted = recorder.fills.filter((fill) => (
      fill.x < box.x + box.width
      && fill.x + fill.w > box.x
      && fill.y < box.y + box.height
      && fill.y + fill.h > box.y
      && fill.alpha > 0
    ));
    assert.ok(painted.length > 0, `${pick.variant} is visible inside its hitbox`);
  }
});

test('the recorded dialogue voices stay switched off without touching the text', () => {
  assert.equal(ENABLE_DIALOGUE_VOICES, false, 'the voices are muted by the flag');
  const game = createGame();
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
  while (game.state !== 'reunion' && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.state, 'reunion', 'the reunion still starts');
  guard = 0;
  while (!(game.reunion && game.reunion.phase === 'dialogue') && guard < 400) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.reunion.phase, 'dialogue', 'the dialogue still plays');
  assert.equal(game.audio.tracks.get('samuel'), undefined, 'no voice file is played');
  assert.equal(game.audio.tracks.get('ali'), undefined, 'no voice file is played');
  assert.equal(game.audio.isVoiceIdle(), true, 'the dialogue never waits for audio');

  // The beats keep their text and their order.
  assert.equal(REUNION_BEATS.length, 7);
  assert.equal(REUNION_BEATS[0].line, 'Perdóname, mi amor, te amo con todo mi corazón.');
  assert.equal(REUNION_BEATS[6].line, 'Tendrás que demostrarlo.');
});

test('the music and the kick effect keep working while the voices are muted', () => {
  const game = createGame();
  game.start();
  assert.equal(game.audio.tracks.get('solo').paused, false, 'Sin Ti still plays');
  assert.equal(game.audio.music, 'solo');
  game.audio.speak('boy');
  assert.equal(game.audio.tracks.get('samuel'), undefined, 'only voices are muted');
  assert.equal(game.audio.tracks.get('solo').paused, false, 'the music is untouched');
});

test('a Baby built directly behaves like the one in the game', () => {
  const baby = new Baby(200);
  assert.equal(baby.maxJumps, 2, 'he has a double jump of his own');
  assert.equal(baby.state, 'enter', 'he catches up first');
  assert.equal(baby.jump(), false, 'no jumping while he is still catching up');
  baby.x = baby.targetX;
  baby.state = 'run';
  assert.equal(baby.jump(), 'first');
  assert.equal(baby.jump(), 'second');
  assert.equal(baby.jump(), false, 'and no third jump');
  // He falls back to the road on his own.
  let guard = 0;
  while (!baby.grounded && guard < 300) {
    baby.update(1 / 60, 340);
    guard += 1;
  }
  assert.equal(baby.grounded, true);
  assert.equal(baby.jumpsUsed, 0, 'landing resets him');
  assert.equal(baby.y + baby.height, GROUND_Y, 'his feet are on the road');
});
