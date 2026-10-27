import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM stubs so the real game loop can run headlessly. Installed
// before the dynamic imports, since the game touches `window` on start-up.
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

// Deterministic randomness for the whole suite.
let randomSeed = 20260214;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { Game } = await import('../src/game/Game.js');
const { Rival } = await import('../src/game/Rival.js');
const { Obstacle, COUPLE_VARIANTS } = await import('../src/game/Obstacle.js');
const {
  GAME_WIDTH, GROUND_Y, KICK_QUIPS, KICK_ACTIVE_START, KICK_ACTIVE_END,
  KICK_SUCCESS_TARGET,
} = await import('../src/game/config.js');

function createGame(notices = []) {
  return new Game(createCanvas(), {
    onNotice: (message) => notices.push(message),
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: () => {},
    onKickCountChange: () => {},
  });
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

test('full solo run: four crystals, reunion, seven beats, then the couple', () => {
  const notices = [];
  const game = createGame(notices);
  game.start();
  assert.equal(game.state, 'running');
  game.spawnDistance = 1e9; // no random hazards on this scripted run

  // Each crystal is walked onto the runner, exactly four of them.
  for (let index = 0; index < 4; index += 1) {
    const entry = game.crystals.entries.find((candidate) => !candidate.collected);
    entry.distance = game.distance;
    entry.height = 52;
    stepFrames(game, 4);
    assert.equal(game.crystals.collected, index + 1);
  }
  assert.equal(game.crystals.complete, true);
  assert.ok(notices.some((notice) => /cuatro cristales/i.test(notice)));

  // She waits ahead while the world wakes toward the white city.
  assert.equal(game.girl.active, true);
  stepFrames(game, 60);
  assert.ok(game.mood > 0.05, 'the fourth crystal starts the transition');
  assert.ok(game.girl.x > game.player.x, 'she is still waiting down the path');

  // Reaching her starts the cinematic instead of the crystal collection.
  let guard = 0;
  while (game.state === 'running' && guard < 600) {
    stepFrames(game, 1);
    guard += 1;
  }
  assert.equal(game.state, 'reunion');
  assert.equal(game.reunion.phase, 'approach', 'the approach plays first');

  stepFrames(game, 30);
  const crop = game.cameraCrop;
  assert.ok(crop, 'the camera frames the two of them');
  assert.ok(crop.width < 480 && crop.height < 270, 'the shot moves closer');
  assert.ok(crop.x >= 0 && crop.y >= 0, 'the crop stays inside the buffer');
  assert.ok(crop.x + crop.width <= 480 && crop.y + crop.height <= 270);

  stepFrames(game, 30);
  assert.equal(game.reunion.phase, 'dialogue');
  assert.equal(game.reunion.beatIndex, 0);
  game.render(); // draws the dialogue box and the camera cut

  // The world is frozen while the scene plays.
  const frozenDistance = game.distance;
  const frozenScroll = game.scroll;
  stepFrames(game, 10);
  assert.equal(game.distance, frozenDistance);
  assert.equal(game.scroll, frozenScroll);
  assert.equal(game.state, 'reunion');

  // Beats 1-4: one line per press, never skipped. The loop waits for the
  // current beat to be the one on screen and for its line to be readable, so
  // the timing never depends on how many frames the earlier phases took.
  for (let index = 0; index < 4; index += 1) {
    let wait = 0;
    while (game.reunion.beatIndex < index && wait < 600) {
      stepFrames(game, 1);
      wait += 1;
    }
    assert.equal(game.reunion.beatIndex, index, 'the line waits for input');
    // Let the typewriter finish the line before pressing.
    stepFrames(game, 60);
    assert.equal(game.reunion.beatIndex, index, 'the line is still on screen');
    game.handleJump();
    stepFrames(game, 2);
  }
  assert.equal(game.reunion.beatIndex, 4);

  // Beat 5: Ali's pause ignores input and advances on its own.
  stepFrames(game, 20);
  assert.equal(game.reunion.beatIndex, 4, 'her pause cannot be skipped');
  for (let index = 0; index < 5; index += 1) {
    game.handleJump();
  }
  assert.equal(game.reunion.beatIndex, 4, 'repeated input never skips the pause');
  stepFrames(game, 3.0 * 60);
  assert.equal(game.reunion.beatIndex, 5, 'she answers after the silence');

  // Beats 6-7: her two lines, then the outro.
  for (let index = 5; index < 7; index += 1) {
    stepFrames(game, 40);
    game.handleJump();
    stepFrames(game, 2);
  }
  assert.equal(game.reunion.phase, 'outro');
  assert.equal(game.player.speaking, false);

  stepFrames(game, 3.0 * 60);
  assert.equal(game.state, 'running');
  assert.equal(game.couple, true);
  assert.equal(game.reunion, null);
  assert.equal(game.player.maxJumps, 2, 'the shared double jump is unlocked');
  assert.equal(game.girl.maxJumps, 2);
  assert.ok(game.mood > 0.5, 'the world is now the bright city');

  // The couple stage spawns its own bright obstacle set.
  game.spawnDistance = 0;
  stepFrames(game, 2);
  assert.equal(game.hazards.length, 1);
  assert.ok(game.hazards[0] instanceof Obstacle);
  assert.ok(COUPLE_VARIANTS.some((entry) => entry.variant === game.hazards[0].variant));
  assert.equal(game.hazards[0].kickable, false);

  // One jump input drives both runners, each with its own physics.
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 1);
  stepFrames(game, 8); // she answers a beat later
  assert.equal(game.girl.jumpsUsed, 1);
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 2);
  stepFrames(game, 6);
  assert.equal(game.girl.jumpsUsed, 2);

  const kickTimeBefore = game.player.kickTime;
  game.handleKick();
  assert.equal(game.player.kickTime, kickTimeBefore, 'the kick stays solo-stage only');
  game.render();
});

test('the kick knocks a rival out and shows one configurable quip', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  const rival = new Rival(GAME_WIDTH + 30, GROUND_Y, 'diva');
  assert.equal(rival.kickable, true);
  game.hazards.push(rival);

  let guard = 0;
  while (rival.x > game.player.x + 45 && guard < 400) {
    stepFrames(game, 1);
    guard += 1;
  }
  assert.equal(game.state, 'running', 'the rival is jumped or kicked, never walked into');

  game.handleKick();
  assert.equal(game.player.state, 'kick');
  const kickTime = game.player.kickTime;
  game.handleKick();
  assert.ok(game.player.kickTime <= kickTime + 1e-6, 'the kick has a cooldown');

  // The active window opens a few frames into the kick.
  stepFrames(game, Math.ceil((KICK_ACTIVE_START + 0.02) * 60));
  assert.equal(rival.knocked, true, 'the kick connects');
  assert.equal(game.comments.comments.length, 1, 'a single quip appears');
  assert.ok(KICK_QUIPS.includes(game.comments.comments[0].text));
  assert.equal(game.kickCount, 1, 'the successful kick is counted once');

  stepFrames(game, 30);
  assert.equal(rival.getBounds(), null, 'a knocked rival is no longer lethal');
  game.render();
});

test('a kick that touches nothing leaves only a soft whiff', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  game.handleKick();
  stepFrames(game, 20);
  assert.equal(game.comments.comments.length, 0, 'no quip on a miss');
  assert.ok(game.effects.particles.length > 0, 'the miss still gives feedback');
});

test('the kick works on the ground and in mid-air, including a double jump', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;

  // Ground kick.
  assert.equal(game.player.grounded, true);
  game.handleKick();
  assert.equal(game.player.state, 'kick');
  assert.equal(game.player.kickFromAir, false);

  // Airborne kick during a jump.
  stepFrames(game, 30);
  game.handleJump();
  stepFrames(game, 4);
  assert.equal(game.player.grounded, false);
  game.handleKick();
  assert.equal(game.player.state, 'kick', 'the kick is allowed in mid-air');
  assert.equal(game.player.kickFromAir, true);

  // The hitbox follows the runner while he is airborne.
  stepFrames(game, Math.ceil((KICK_ACTIVE_START + 0.02) * 60));
  assert.ok(game.player.getKickBounds(), 'an airborne kick still has a hitbox');
  assert.equal(game.player.state, 'kick', 'the jump does not steal the kick state');

  // The kick protects the runner while it plays, so the rival cannot punish
  // the wind-up.
  assert.equal(game.player.kickGuard, true, 'the runner is guarded during the kick');
});

test('the kick also works during the shared double jump', () => {
  const game = createGame();
  game.start();
  // The couple stage unlocks the double jump.
  game.player.unlockDoubleJump();
  game.spawnDistance = 1e9;

  game.handleJump();
  stepFrames(game, 4);
  assert.equal(game.player.grounded, false);
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 2, 'the double jump is available');

  // A kick in the middle of the double jump still connects.
  stepFrames(game, 2);
  game.handleKick();
  assert.equal(game.player.state, 'kick', 'a double-jump kick connects');
  assert.equal(game.player.kickFromAir, true);

  stepFrames(game, Math.ceil((KICK_ACTIVE_START + 0.02) * 60));
  assert.ok(game.player.getKickBounds(), 'the hitbox is live in the double jump');
  assert.equal(game.player.state, 'kick', 'the double jump does not steal the kick');

  // Both jumps are spent, so the runner keeps kicking until he lands.
  assert.equal(game.player.jumpsUsed, game.player.maxJumps);
});

test('a landed kick freezes the world briefly and shakes the screen', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  const rival = new Rival(game.player.x + 60, GROUND_Y, 'diva');
  game.hazards.push(rival);

  game.handleKick();
  stepFrames(game, Math.ceil((KICK_ACTIVE_START + 0.02) * 60));
  assert.equal(rival.knocked, true, 'the kick connects');
  assert.ok(game.hitStop > 0, 'the impact freezes the simulation');
  assert.ok(game.shake > 0, 'the impact shakes the screen');
  game.render();
});

test('the kick counter counts each rival once and celebrates at five', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;

  for (let index = 0; index < KICK_SUCCESS_TARGET; index += 1) {
    const rival = new Rival(game.player.x + 60, GROUND_Y, 'diva');
    game.hazards.push(rival);
    game.handleKick();
    stepFrames(game, Math.ceil((KICK_ACTIVE_START + 0.02) * 60));
    // Let the kick recover before the next one.
    stepFrames(game, 30);
  }

  assert.equal(game.kickCount, KICK_SUCCESS_TARGET, 'every rival counts once');
  assert.ok(game.comments.comments.some((comment) => comment.text === '¡Súper exitoso!'));
  assert.equal(game.successMessageShown, true);
});

test('the armed shooter is gone: no projectiles, no bullets, no damage', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  game.robberTimer = 0;
  stepFrames(game, 2);

  // The thief may show up, but he is unarmed and he never shoots.
  if (game.robber) {
    assert.equal(game.robber.getBounds(), null, 'the thief has no hitbox');
    assert.ok(!('shots' in game), 'the projectile list is gone');
  }
  assert.equal(game.shots, undefined, 'there is no projectile array at all');

  // Running the solo section never ends the run because of a bullet.
  stepFrames(game, 600);
  assert.equal(game.state, 'running');
  game.render();
});

test('the theft takes the money once and never hurts the runner', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  assert.equal(game.money, 100, 'the run starts with $100');

  game.robberTimer = 0;
  stepFrames(game, 2);
  assert.ok(game.robber, 'the thief shows up');
  assert.equal(game.robber.getBounds(), null, 'he is harmless');

  // The encounter plays out: threat, steal, flee.
  stepFrames(game, 60 * 10);
  assert.equal(game.money, -20, 'the balance ends up in the red');
  assert.equal(game.state, 'running', 'the runner is never hurt');
  assert.equal(game.robberyDone, true, 'the encounter happens only once');

  // No second robbery later in the run.
  stepFrames(game, 60 * 5);
  assert.equal(game.money, -20, 'the money is not taken twice');
});

test('the money counter and the kick counter are reported to the UI', () => {
  const seen = { money: [], kicks: [] };
  const game = new Game(createCanvas(), {
    onNotice: () => {},
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: (value) => seen.money.push(value),
    onKickCountChange: (value) => seen.kicks.push(value),
  });
  game.start();
  assert.ok(seen.money.includes(100), 'the HUD starts at $100');
  assert.ok(seen.kicks.includes(0), 'the kick counter starts at zero');
});

test('gameplay inputs never leak into dialogue or restart', () => {
  const game = createGame();
  game.handleAdvance(); // Enter on the start screen
  assert.equal(game.state, 'start');
  game.handleKick(); // X on the start screen
  assert.equal(game.state, 'start');

  game.handleJump(); // Space still starts the run
  assert.equal(game.state, 'running');

  game.pause();
  game.handleJump(); // jumping while paused stays paused
  assert.equal(game.state, 'paused');
  game.handleKick();
  assert.equal(game.state, 'paused');
  game.handleAdvance();
  assert.equal(game.state, 'paused');
});
