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

let randomSeed = 778899;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { Game } = await import('../src/game/Game.js');
const {
  CRYSTAL_COUNT, KISSES_REQUIRED_FOR_BABY, LIFE_GRACE_SECONDS,
  SURVIVAL_DELAY_MIN, SURVIVAL_DELAY_MAX, SURVIVAL_WARNING_SECONDS,
  SURVIVAL_SECONDS, ENDING_GIRL_X, ENDING_BOY_X, ENDING_CROP,
} = await import('../src/game/config.js');

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
    onLivesChange: hooks.onLivesChange ?? (() => {}),
  });
  game.audio.unlock();
  return game;
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

// Walk the required crystals onto the runner, then let the reunion play out
// into couple running. Random spawns stay muted for determinism.
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

function kissTimes(game, count) {
  for (let index = 0; index < count; index += 1) {
    game.handleKick();
    let guard = 0;
    while (game.state === 'couplekiss' && guard < 300) {
      game.advance(1 / 60);
      guard += 1;
    }
    assert.equal(game.state, 'running', 'the kiss finished');
  }
}

// Kiss to the required count, then wait for the baby's arrival to complete.
function joinBaby(game) {
  kissTimes(game, KISSES_REQUIRED_FOR_BABY);
  assert.ok(game.baby, 'the baby arrives at the required kiss count');
  let guard = 0;
  while (game.baby.state !== 'run' && guard < 240) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.baby.state, 'run', 'the arrival finished');
}

const graceFrames = () => Math.ceil(LIFE_GRACE_SECONDS * 60) + 6;

test('the couple starts with exactly two lives, and the baby adds the third', () => {
  const lives = [];
  const game = createGame({ onLivesChange: (count) => lives.push(count) });
  reachCouple(game);

  assert.equal(game.lives, 2, 'two lives at the start of couple running');
  assert.deepEqual(game.lifeOrder, ['boy', 'ali'], 'death order starts with Samuel');
  assert.equal(lives[lives.length - 1], 2, 'the HUD is told immediately');

  joinBaby(game);
  assert.equal(game.lives, 3, 'the baby grants one additional life');
  assert.deepEqual(game.lifeOrder, ['boy', 'ali', 'baby']);
  assert.equal(lives[lives.length - 1], 3, 'the HUD shows three hearts');
});

test('damage takes Samuel first, Ali second, and the baby third', () => {
  const lives = [];
  const game = createGame({ onLivesChange: (count) => lives.push(count) });
  reachCouple(game);
  joinBaby(game);
  game.survivalDelay = 1e9; // keep the guerrilla event out of this test

  assert.equal(game.loseLife(400, 400), true);
  assert.equal(game.player.dead, true, 'Samuel dies first');
  assert.equal(game.girl.dead, false);
  assert.equal(game.baby.dead, false);
  assert.equal(game.lives, 2);
  assert.equal(game.loseLife(400, 400), false, 'one event costs at most one life');
  assert.ok(game.lifeGrace > 0, 'the grace window is active');

  stepFrames(game, graceFrames());
  game.survivalDelay = 1e9;
  assert.equal(game.loseLife(400, 400), true);
  assert.equal(game.girl.dead, true, 'Ali dies second');
  assert.equal(game.lives, 1);

  stepFrames(game, graceFrames());
  assert.equal(game.loseLife(400, 400), true);
  assert.equal(game.baby.dead, true, 'the baby dies third');
  assert.equal(game.lives, 0);
  assert.equal(game.state, 'gameover', 'the normal game over follows the last life');
  assert.equal(lives[lives.length - 1], 0, 'the HUD reads zero');
});

test('without the baby the family has exactly two lives', () => {
  const game = createGame();
  reachCouple(game);
  assert.equal(game.lives, 2);
  game.loseLife(400, 400);
  assert.equal(game.player.dead, true);
  assert.equal(game.lives, 1);
  stepFrames(game, graceFrames());
  game.loseLife(400, 400);
  assert.equal(game.girl.dead, true);
  assert.equal(game.state, 'gameover');
});

test('Samuel dying before the baby joins revokes the baby for this run', () => {
  const game = createGame();
  reachCouple(game);
  kissTimes(game, 2); // halfway to the unlock

  game.loseLife(400, 400);
  assert.equal(game.player.dead, true);
  assert.equal(game.babyLocked, true, 'the unlock is revoked permanently');
  assert.equal(game.baby, null);

  // Even a delayed or forced unlock can no longer spawn the baby.
  game.kisses = KISSES_REQUIRED_FOR_BABY + 5;
  game.revealBaby();
  assert.equal(game.baby, null, 'no baby after the eligibility was revoked');
  assert.equal(game.babyRevealed, false);

  // And without Samuel the kiss itself stays silent.
  game.handleKick();
  assert.notEqual(game.state, 'couplekiss', 'no kiss without both runners');
  assert.equal(game.state, 'running');
});

test('Samuel dying during the baby arrival keeps the baby in the family', () => {
  const game = createGame();
  reachCouple(game);
  kissTimes(game, KISSES_REQUIRED_FOR_BABY);
  assert.ok(game.baby);
  assert.equal(game.baby.state, 'enter', 'still arriving');
  assert.equal(game.lives, 3);

  game.loseLife(400, 400); // Samuel falls mid-arrival
  assert.equal(game.player.dead, true);
  assert.equal(game.babyLocked, false, 'already unlocked is not revoked');
  assert.equal(game.lives, 2, 'Ali and the baby remain');

  let guard = 0;
  while (game.baby.state !== 'run' && guard < 240) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.equal(game.baby.state, 'run', 'the arrival completes');
  assert.equal(game.baby.dead, false);
});

test('the guerrilla event waits 3–5 s after the baby joins, and only then', () => {
  const game = createGame();
  reachCouple(game);
  assert.equal(game.survival, null, 'never before the baby joins');
  assert.equal(game.survivalDelay, null);

  stepFrames(game, 15 * 60); // a long soak as a childless couple
  assert.equal(game.survival, null, 'not during couple running without the baby');
  assert.equal(game.survivalDelay, null);

  joinBaby(game);
  assert.ok(game.survivalDelay !== null || game.survivalDelayStarted, 'the delay is armed on arrival');

  stepFrames(game, Math.ceil((SURVIVAL_DELAY_MIN - 0.2) * 60));
  assert.equal(game.survival, null, 'not before three seconds');
  let guard = 0;
  while (!game.survival && guard < Math.ceil((SURVIVAL_DELAY_MAX + 1) * 60)) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival, 'the event starts inside the 3–5 second window');
  assert.equal(game.survivalDelay, null, 'the delay is consumed');
  assert.ok(SURVIVAL_DELAY_MAX - SURVIVAL_DELAY_MIN === 2, 'the window is 3–5 seconds');

  // Once per run: the same encounter keeps running, never a second one.
  const first = game.survival;
  stepFrames(game, 4 * 60);
  assert.equal(game.survival, first, 'the encounter is not restarted');
  assert.ok(game.guerrillas.length <= 2, 'never more than two fighters');
});

test('the survival clock starts with the first active enemy, not the delay', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  let guard = 0;
  while (!game.survival && guard < 800) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival);
  assert.equal(game.survival.phase, 'warning', 'the event opens with a warning');
  assert.equal(game.survival.elapsed, 0, 'nothing counted yet');
  assert.equal(game.survivalShots.length, 0, 'no shots during the warning');
  assert.ok(game.survival.t < SURVIVAL_WARNING_SECONDS);

  guard = 0;
  while (game.survival && game.survival.phase !== 'active' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival && game.survival.phase === 'active', 'the enemies are active');
  assert.equal(game.survival.elapsed, 0, 'the five seconds start exactly here');
  assert.ok(game.survival.elapsed < game.survival.t, 'the approach delay is never counted');
});

// Drives an encounter: waits for it, waits out the warning, then either
// dodges everything (survive) or lets the shots land (die).
function driveEncounter(game, { survive }) {
  let guard = 0;
  while (!game.survival && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival, 'the encounter started');
  guard = 0;
  while (game.survival && game.survival.phase !== 'active' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival && game.survival.phase === 'active');

  let activeFrames = 0;
  guard = 0;
  while (game.state === 'running' && guard < 900) {
    if (survive) {
      game.survivalShots.length = 0; // perfect dodging, frame by frame
    }
    game.advance(1 / 60);
    if (game.survival && game.survival.phase === 'active') {
      activeFrames += 1;
    }
    guard += 1;
  }
  return activeFrames;
}

test('surviving five full seconds is a milestone, not an ending', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  const activeFrames = driveEncounter(game, { survive: true });

  assert.ok(
    activeFrames >= SURVIVAL_SECONDS * 60 - 2,
    `survived ${activeFrames} active frames (need ${SURVIVAL_SECONDS * 60})`,
  );
  assert.equal(game.state, 'running', 'the run continues after the milestone');
  assert.equal(game.endingScene, null, 'the milestone does not start Continuará...');
  assert.ok(game.survival, 'the encounter remains active');
  assert.equal(game.survival.milestone, true, 'the milestone is recorded');
  assert.ok(game.guerrillas.length > 0, 'the guerrillas are not removed');
  assert.ok(game.distance > 0, 'the road keeps scrolling');
});

test('the ending can still start explicitly but is never reached by the timer', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  driveEncounter(game, { survive: true });
  assert.equal(game.endingScene, null, 'the timer alone never starts the ending');
  assert.equal(game.startEnding(), true, 'the explicit ending transition still works');
  assert.equal(game.state, 'ending');
  assert.equal(game.endingScene.showBaby, false, 'the baby stays out of the couple composition');

  stepFrames(game, Math.ceil(1.4 * 60));
  assert.equal(game.player.x, ENDING_BOY_X, 'he eases to the centre');
  assert.equal(game.girl.x, ENDING_GIRL_X, 'she eases to the centre');
  assert.equal(game.player.state, 'kiss', 'Samuel is kissing');
  assert.equal(game.girl.state, 'kiss', 'Ali is kissing');
  assert.equal(game.startEnding(), false, 'the ending cannot be requested twice');

  const crop = game.cameraCrop;
  assert.ok(crop, 'the ending has its own cinematic crop');
  assert.ok(crop.x >= 0 && crop.y >= 0, 'the crop stays inside the buffer');
  assert.ok(crop.x + crop.width <= 480 && crop.y + crop.height <= 270);
  game.render(); // the ending scene must draw cleanly
});

test('gameplay remains active after the five-second milestone', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  driveEncounter(game, { survive: true });
  assert.equal(game.state, 'running');

  const distance = game.distance;
  game.handleJump();
  assert.equal(game.player.jumpsUsed, 1, 'the player can still jump');
  stepFrames(game, 30);
  assert.ok(game.distance > distance, 'the run keeps advancing');
  assert.ok(game.survival, 'the same continuous encounter remains');
  assert.equal(game.survival.milestone, true, 'the milestone is not restarted');
});

test('dying before the five seconds prevents the special ending', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  let guard = 0;
  while (!game.survival && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  guard = 0;
  while (game.survival && game.survival.phase !== 'active' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival && game.survival.phase === 'active');

  // Lose every life through the centralised system while the clock runs.
  guard = 0;
  while (game.state === 'running' && game.lifeOrder.length > 0 && guard < 600) {
    game.survivalShots.length = 0;
    game.loseLife(400, 400);
    stepFrames(game, graceFrames());
    guard += 1;
  }
  assert.equal(game.state, 'gameover', 'the family was eliminated first');
  assert.equal(game.endingScene, null, 'no ending from game over');
  assert.equal(game.survival, null, 'the encounter is cancelled on death');

  // Even well past five seconds, the ending never fires.
  stepFrames(game, Math.ceil((SURVIVAL_SECONDS + 1) * 60));
  assert.equal(game.state, 'gameover');
  assert.equal(game.endingScene, null);
});

test('restarting after the survival milestone creates a clean new run', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  driveEncounter(game, { survive: true });
  assert.equal(game.state, 'running');

  game.start();
  assert.equal(game.state, 'running');
  assert.equal(game.lives, 0, 'lives reset');
  assert.deepEqual(game.lifeOrder, []);
  assert.equal(game.player.dead, false);
  assert.equal(game.girl.dead, false);
  assert.equal(game.baby, null);
  assert.equal(game.babyRevealed, false);
  assert.equal(game.babyLocked, false, 'eligibility resets only on a new run');
  assert.equal(game.survival, null);
  assert.equal(game.survivalDelay, null);
  assert.equal(game.endingScene, null);
  assert.deepEqual(game.guerrillas, []);
  assert.deepEqual(game.survivalShots, []);
});

test('a hidden tab (pause) freezes the encounter and resumes cleanly', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  let guard = 0;
  while (!game.survival && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  guard = 0;
  while (game.survival && game.survival.phase !== 'active' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival && game.survival.phase === 'active');

  // Tab hidden: the game pauses itself and the survival clock stops dead.
  game.pause();
  assert.equal(game.state, 'paused');
  const elapsed = game.survival.elapsed;
  const shotCount = game.survivalShots.length;
  stepFrames(game, 120); // two seconds of hidden-tab frames
  assert.equal(game.survival.elapsed, elapsed, 'the clock does not advance while paused');
  assert.equal(game.survivalShots.length, shotCount, 'no projectiles move while paused');

  game.resume();
  stepFrames(game, 30);
  assert.ok(game.survival.elapsed > elapsed, 'the clock continues after resuming');
  assert.equal(game.state, 'running');
});

test('restarting mid-encounter clears timers, enemies and projectiles', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  let guard = 0;
  while (!game.survival && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  guard = 0;
  while (game.survival && game.survival.phase !== 'active' && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  // Let at least one chancleta fly so the restart has something to clean up.
  guard = 0;
  while (game.survivalShots.length === 0 && guard < 300) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survivalShots.length > 0, 'an attack is in flight');

  game.start(); // the player restarts while the event is running
  assert.equal(game.state, 'running');
  assert.equal(game.survival, null, 'no stale encounter');
  assert.equal(game.survivalDelay, null, 'no stale timer');
  assert.equal(game.survivalDelayStarted, false, 'a new run may arm it again');
  assert.deepEqual(game.survivalShots, [], 'no stale projectiles');
  assert.deepEqual(game.guerrillas, [], 'no stale enemies');
  assert.equal(game.baby, null, 'no stale baby');
  stepFrames(game, 60);
  assert.equal(game.survival, null, 'nothing respawns by itself');
  assert.equal(game.state, 'running');
});

test('every active guerrilla has a persistent label tied to its entity', () => {
  const game = createGame();
  reachCouple(game);
  joinBaby(game);
  let guard = 0;
  while (!game.survival && guard < 900) {
    game.advance(1 / 60);
    guard += 1;
  }
  assert.ok(game.survival);
  assert.equal(game.guerrillas.length, 2, 'both fighters spawned');

  for (const guerrilla of game.guerrillas) {
    assert.equal(guerrilla.label, undefined, 'labels are rendered from live entities, not duplicated');
  }

  const first = game.guerrillas[0];
  const oldX = first.x;
  game.guerrillas[0].x += 80;
  game.render();
  assert.notEqual(game.guerrillas[0].x, oldX, 'the entity moved before rendering');
  assert.equal(game.guerrillas.length, 2, 'rendering creates no duplicate enemies or labels');

  game.start();
  assert.deepEqual(game.guerrillas, [], 'restart removes the fighters and their labels');
  assert.deepEqual(game.survivalShots, []);
});

test('the HUD and UI expose lives and the special ending correctly', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  // Lives chip: distinct label, hidden until the couple stage starts.
  assert.match(html, /id="livesChip"[^>]*hidden/, 'the lives chip starts hidden');
  assert.match(html, /Vidas:/, 'the lives label is Spanish');
  assert.match(main, /onLivesChange/, 'the HUD is wired to the life system');

  // The ending screen: exact title, separate restart control, and the
  // ordinary respawn screen stays out of it.
  assert.match(html, /id="endingScreen"/, 'the ending has its own screen');
  assert.match(html, /<div class="ending-title">Continuará\.\.\.<\/div>/,
    'the title is exactly Continuará...');
  assert.match(html, /id="endingRestartButton"/, 'a separate restart control exists');
  assert.doesNotMatch(html, /Volver a jugar/, 'the old respawn label is gone');
  assert.match(main, /endingScreen\.hidden = state !== 'ending'/,
    'the ending screen follows the game state');
  assert.match(main, /endingRestartButton\.addEventListener/,
    'the restart control is wired');
});
