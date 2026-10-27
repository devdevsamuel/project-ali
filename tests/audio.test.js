import test from 'node:test';
import assert from 'node:assert/strict';

// Headless stand-ins for the browser audio/DOM surface, installed before the
// dynamic imports so the real AudioManager runs against a fake Audio element.
class FakeAudio {
  constructor(url) {
    this.url = url;
    this.paused = true;
    this.currentTime = 0;
    this.volume = 1;
    this.loop = false;
    this.preload = '';
    this.playCount = 0;
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
    this.playCount += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  emit(type) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler();
    }
  }
}

function createCanvas() {
  const context = {
    globalAlpha: 1,
    fillStyle: '',
    imageSmoothingEnabled: false,
    setTransform() {}, save() {}, restore() {}, clearRect() {}, fillRect() {},
    drawImage() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  return {
    width: 960,
    height: 540,
    getContext: () => context,
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
globalThis.Audio = FakeAudio;

// Deterministic randomness for the whole suite.
let randomSeed = 987654321;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { AudioManager } = await import('../src/game/Audio.js');
const { Game } = await import('../src/game/Game.js');
const { Rival } = await import('../src/game/Rival.js');
const { GROUND_Y, OUTRO_KISS_END } = await import('../src/game/config.js');

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
  // Simulates the player's first gesture (Start button / first tap).
  game.audio.unlock();
  return game;
}

function stepFrames(game, frames, dt = 1 / 60) {
  for (let index = 0; index < frames; index += 1) {
    game.advance(dt);
  }
}

function stepUntil(game, predicate, maxFrames = 5000) {
  for (let index = 0; index < maxFrames; index += 1) {
    game.advance(1 / 60);
    if (predicate()) {
      return true;
    }
  }
  return predicate();
}

test('the kick sound fires on the impact of a landed hit, never on a miss', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9; // keep the scripted road clear of random spawns
  const rival = new Rival(990, GROUND_Y, 'diva');
  game.hazards.push(rival);

  let guard = 0;
  while (rival.x > game.player.x + 45 && guard < 400) {
    stepFrames(game, 1);
    guard += 1;
  }

  game.handleKick();
  stepFrames(game, 12); // inside the active window (0.14 s - 0.30 s)
  const kickSound = game.audio.tracks.get('kick');
  assert.equal(rival.knocked, true, 'the kick connects');
  assert.equal(kickSound.playCount, 1, 'the impact sound plays with the hit');

  stepFrames(game, 60); // through recovery and the cooldown
  assert.equal(kickSound.playCount, 1, 'one landed hit sounds exactly once');

  // A second kick with nothing in range must stay silent.
  game.hazards = [];
  game.handleKick();
  assert.equal(game.player.state, 'kick', 'the cooldown has expired');
  stepFrames(game, 20); // past the active window
  assert.equal(game.kickWhiffed, true, 'the miss still gives visual feedback');
  assert.equal(kickSound.playCount, 1, 'a missed kick is silent');
});

test('dialogue voice: one recording at a time, queued rather than overlapped', () => {
  const audio = new AudioManager();
  audio.unlock();

  audio.speak('boy');
  const samuel = audio.tracks.get('samuel');
  assert.equal(samuel.playCount, 1, "Samuel's recording starts with his line");

  audio.speak('boy'); // his next beat
  assert.equal(samuel.playCount, 1, 'his recording keeps running, never restarts');

  audio.speak('ali'); // her turn arrives while he is still talking
  assert.equal(audio.tracks.get('ali')?.playCount ?? 0, 0, 'recordings never overlap');
  assert.equal(audio.pendingVoice, 'ali', 'hers is queued behind his');

  samuel.emit('ended');
  const ali = audio.tracks.get('ali');
  assert.equal(ali.playCount, 1, "hers starts the moment his finishes");
  assert.equal(audio.voice, 'ali');

  audio.stopVoice();
  assert.equal(ali.paused, true, 'the conversation can be cut cleanly');
  assert.equal(audio.voice, null);
  assert.equal(audio.pendingVoice, null);
});

test('only one background song plays, and only once per request', () => {
  const audio = new AudioManager();
  audio.unlock();

  audio.playMusic('solo');
  const solo = audio.tracks.get('solo');
  assert.equal(solo.paused, false);
  assert.equal(solo.loop, true, 'the theme keeps going through the run');
  assert.equal(solo.volume, 0.4);

  audio.playMusic('solo');
  assert.equal(solo.playCount, 1, 'repeated requests do not restart the song');

  audio.playMusic('couple');
  const couple = audio.tracks.get('couple');
  assert.equal(couple.paused, false);
  assert.equal(solo.paused, true, 'the two songs never play together');
  assert.equal(audio.music, 'couple');

  audio.playMusic('couple');
  assert.equal(couple.playCount, 1, 'no duplicate playback');

  audio.pauseMusic();
  assert.equal(couple.paused, true);
  assert.equal(audio.music, null, 'a paused song cannot resume itself');

  audio.reset();
  assert.equal(couple.currentTime, 0, 'restart rewinds every track');
});

test('audio requested before the first gesture starts after the unlock', () => {
  const audio = new AudioManager();
  audio.playMusic('solo');
  assert.equal(audio.tracks.get('solo').paused, true, 'autoplay policy respected');
  audio.speak('boy');
  assert.equal(audio.tracks.get('samuel').paused, true);

  audio.unlock();
  assert.equal(audio.tracks.get('solo').paused, false, 'the pending song starts');
  assert.equal(audio.tracks.get('samuel').playCount, 1, 'the pending line starts');
});

test('a failing track is reported once and stays silent', () => {
  const audio = new AudioManager();
  audio.unlock();
  const element = audio.element('kick');
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    element.emit('error');
    element.emit('error');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1, 'the failure is reported exactly once');
  audio.kick();
  assert.equal(element.playCount, 0, 'a broken track never plays');
  assert.doesNotThrow(() => audio.playMusic('solo'), 'the game never crashes on audio errors');
});

test('full flow: solo theme, pause at the reunion, reunion song after the kiss', () => {
  const game = createGame();
  game.start();
  game.spawnDistance = 1e9;
  const solo = game.audio.tracks.get('solo');
  assert.equal(solo.paused, false, 'Sin Ti plays during the solo journey');
  assert.equal(game.audio.music, 'solo');

  // Collect the four crystals by walking each one onto the runner.
  for (let index = 0; index < 4; index += 1) {
    const entry = game.crystals.entries.find((candidate) => !candidate.collected);
    entry.distance = game.distance;
    entry.height = 52;
    stepFrames(game, 4);
  }
  assert.equal(game.crystals.complete, true);

  // Reaching her starts the cinematic: the solo theme stops right there.
  assert.ok(stepUntil(game, () => game.state === 'reunion'), 'the reunion begins');
  assert.equal(solo.paused, true, 'Sin Ti pauses when the conversation begins');
  assert.equal(game.audio.music, null);
  assert.equal(
    game.audio.tracks.get('couple'), undefined,
    'the reunion song is not even requested yet',
  );

  // Samuel's voice starts with his first line.
  assert.ok(stepUntil(game, () => game.reunion && game.reunion.phase === 'dialogue'));
  const samuel = game.audio.tracks.get('samuel');
  assert.equal(samuel.playCount, 1, "Samuel's recording plays in the scene");
  assert.equal(solo.paused, true, 'the solo theme stays off during the dialogue');
  assert.equal(
    game.audio.tracks.get('couple'), undefined,
    'nothing plays after the kiss yet either',
  );

  // This build keeps the scene moving on its own, so the beats run to the
  // outro without input; the conversation's recording is cut when it ends.
  assert.ok(stepUntil(game, () => game.reunion && game.reunion.phase === 'outro', 4000));
  assert.equal(samuel.paused, true, 'the voice stops when the conversation ends');
  assert.equal(
    game.audio.tracks.get('couple'), undefined,
    'not before the kiss finishes',
  );

  // After the kiss animation: the reunion song starts, exactly once.
  assert.ok(stepUntil(
    game,
    () => game.reunion && game.reunion.outroT > OUTRO_KISS_END,
    2000,
  ));
  const couple = game.audio.tracks.get('couple');
  assert.equal(couple.playCount, 1, 'Contigo starts right after the kiss');
  assert.equal(couple.paused, false);
  assert.equal(solo.paused, true, 'Sin Ti never comes back');

  // Scene change into the couple run: the song continues, no duplicates.
  assert.ok(stepUntil(game, () => game.state === 'running' && game.couple, 800));
  assert.equal(couple.playCount, 1, 'no duplicate playback across the scene change');
  assert.equal(couple.paused, false, 'the song keeps running while they run together');
  assert.equal(samuel.playCount, 1, "Samuel's line never replayed");
});

test('restarting the game resets the music state', () => {
  const game = createGame();
  game.start();
  game.audio.playMusic('couple'); // as if a previous run reached the kiss
  game.audio.speak('boy');

  game.start(); // the player runs again
  const solo = game.audio.tracks.get('solo');
  const couple = game.audio.tracks.get('couple');
  assert.equal(couple.paused, true, 'the old song stops on restart');
  assert.equal(couple.currentTime, 0);
  assert.equal(game.audio.voice, null, 'no dialogue audio leaks into the new run');
  assert.equal(game.audio.music, 'solo', 'the solo theme starts fresh');
  assert.equal(solo.playCount, 2, 'one fresh start per run');
  assert.equal(solo.paused, false);
});
