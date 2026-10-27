import test from 'node:test';
import assert from 'node:assert/strict';

// Headless stand-ins for the browser audio/DOM surface, installed before the
// dynamic imports so the real AudioManager runs against fake Audio elements.
// `deferred = true` lets a test hold a play() promise open to verify what
// happens when the world changes while the browser is still starting audio.
class FakeAudio {
  constructor(url) {
    this.url = url;
    this.paused = true;
    this.currentTime = 0;
    this.volume = 1;
    this.loop = false;
    this.preload = '';
    this.playbackRate = 1;
    this.duration = 120;
    this.playCount = 0;
    this.listeners = new Map();
    this.deferred = false;
    this.pending = [];
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(handler);
  }

  emit(type) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler();
    }
  }

  play() {
    this.paused = false;
    this.playCount += 1;
    if (this.deferred) {
      return new Promise((resolve) => this.pending.push(resolve));
    }
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  // Settles every held play() promise, like the browser answering later.
  resolvePlays() {
    const resolvers = this.pending.splice(0);
    for (const resolve of resolvers) {
      resolve();
    }
  }
}

function createCanvas() {
  const context = {
    globalAlpha: 1,
    fillStyle: '',
    imageSmoothingEnabled: false,
    setTransform() {}, translate() {}, save() {}, restore() {}, clearRect() {}, fillRect() {},
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

let randomSeed = 24681357;
Math.random = () => {
  randomSeed = (randomSeed * 1103515245 + 12345) % 2147483648;
  return randomSeed / 2147483648;
};

const { AudioManager } = await import('../src/game/Audio.js');
const { Game } = await import('../src/game/Game.js');

function createGame() {
  const game = new Game(createCanvas(), {
    onNotice: () => {},
    onStateChange: () => {},
    onDistanceChange: () => {},
    onHeartsChange: () => {},
    onCrystalsChange: () => {},
    onMoneyChange: () => {},
    onKickCountChange: () => {},
    onKissCountChange: () => {},
    onLivesChange: () => {},
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

// Lets queued microtasks (the .then of a play() promise) run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// 1-3. Temporary pause: hold the active track, keep its position, resume only
//      when the state allows it.
// ---------------------------------------------------------------------------

test('pausing the run pauses the active song and keeps its position', async () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  assert.equal(solo.paused, false, 'Sin Ti plays while running');
  solo.currentTime = 42; // pretend it has been playing for a while

  const kicks = game.audio.element('kick');
  kicks.play(); // an SFX is mid-flight when the player pauses

  game.pause();
  assert.equal(game.state, 'paused');
  assert.equal(solo.paused, true, 'the background song pauses with the game');
  assert.equal(solo.currentTime, 42, 'the position is kept for the resume');
  assert.equal(game.audio.musicHeld, true, 'the hold is explicit state');
  assert.equal(kicks.paused, false, 'sound effects are never held with music');

  // Repeated pause sources (button + shortcut + blur) must be no-ops.
  const playsBefore = solo.playCount;
  const trackCount = game.audio.tracks.size;
  const listenersBefore = solo.listeners.get('ended').length;
  game.pause();
  game.pause();
  game.audio.pauseMusicForGame();
  assert.equal(solo.playCount, playsBefore, 'repeated pauses never re-enter play()');
  assert.equal(game.audio.tracks.size, trackCount, 'no extra audio elements appear');
  assert.equal(solo.listeners.get('ended').length, listenersBefore, 'no extra listeners');
});

test('resuming continues the same position and never loops playback', async () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  solo.currentTime = 42;
  game.pause();
  game.resume();

  assert.equal(game.state, 'running');
  assert.equal(solo.paused, false, 'the song continues after resume');
  assert.equal(solo.currentTime, 42, 'resume never rewinds to the beginning');
  assert.equal(solo.playCount, 2, 'exactly one play per pause/resume cycle');

  // A frame of gameplay must not call play() again.
  stepFrames(game, 120);
  assert.equal(solo.playCount, 2, 'the animation loop never restarts the song');
  assert.equal(game.audio.musicHeld, false, 'the hold is lifted');

  // Resuming is refused once the run is over, even if something calls it.
  game.pause();
  game.audio.stopMusicForRun();
  game.resume();
  assert.equal(game.state, 'running');
  assert.equal(solo.paused, true, 'a terminal stop wins over the resume');
  assert.equal(game.audio.musicStopped, true);
});

test('a terminal stop rejects every later music request', async () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  game.audio.stopMusicForRun();

  assert.equal(solo.paused, true, 'music stops immediately');
  assert.equal(game.audio.music, null, 'the intent is forgotten');

  const before = solo.playCount;
  // Simulates a stale animation callback or a late track switch.
  game.audio.playMusic('solo');
  game.audio.playMusic('couple');
  stepFrames(game, 120);
  assert.equal(solo.playCount, before, 'no stale call restarts anything');
  assert.equal(solo.paused, true, 'the song stays silent on the screen');

  // The music button may still flip the preference, but must not play.
  game.audio.toggleMusic();
  assert.equal(solo.paused, true, 'the button cannot bypass a terminal stop');
  game.audio.toggleMusic();
  assert.equal(solo.paused, true, 'nor by toggling back');
});

// ---------------------------------------------------------------------------
// 4. Racing a pending track transition with a pause.
// ---------------------------------------------------------------------------

test('pausing during a pending play() re-silences it when the promise settles', async () => {
  const audio = new AudioManager();
  audio.unlock();
  const solo = audio.element('solo');
  solo.deferred = true;

  audio.playMusic('solo'); // play() is now in flight
  assert.equal(solo.paused, false, 'playback was requested');

  audio.pauseMusicForGame(); // the player pauses before it settles
  assert.equal(solo.paused, true, 'the held state pauses it right away');

  solo.resolvePlays(); // the browser answers "playing" only now
  await flush();
  assert.equal(solo.paused, true, 'the stale play() promise is re-silenced');

  // Same-intent calls while held are no-ops: nothing re-enters play().
  const plays = solo.playCount;
  for (let index = 0; index < 10; index += 1) {
    audio.playMusic('solo');
  }
  assert.equal(solo.playCount, plays, 'held intent never re-triggers playback');

  audio.resumeMusicFromGame();
  assert.equal(solo.paused, false, 'the explicit resume starts it again');
  assert.equal(solo.currentTime, 0, 'from its saved position');
});

// ---------------------------------------------------------------------------
// 5-6. The life system: non-final loss keeps playing, final loss is silent.
// ---------------------------------------------------------------------------

test('losing a non-final life keeps the run and its music going', () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  game.lifeOrder = ['boy', 'ali'];
  game.lives = 2;
  game.lifeGrace = 0;

  const lost = game.loseLife(400, 400);
  assert.equal(lost, true, 'a life is lost');
  assert.equal(game.state, 'running', 'not a game over');
  assert.equal(game.lives, 1, 'one life remains');
  assert.equal(solo.paused, false, 'the music carries on');
});

test('losing the final life silences the run immediately', () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  game.lifeOrder = ['boy'];
  game.lives = 1;
  game.lifeGrace = 0;

  game.loseLife(400, 400);
  assert.equal(game.state, 'gameover');
  assert.equal(solo.paused, true, 'the song stops with the final life');
  assert.equal(game.audio.musicStopped, true);
  assert.equal(game.audio.music, null);
});

// ---------------------------------------------------------------------------
// 7. Nothing on the game-over screen can bring music back.
// ---------------------------------------------------------------------------

test('no callback, ended handler or frame restarts music after game over', async () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  game.lifeOrder = ['boy'];
  game.lives = 1;
  game.lifeGrace = 0;
  game.loseLife(400, 400);
  assert.equal(game.state, 'gameover');

  const before = solo.playCount;
  // A stale animation-loop style request and a track switch attempt.
  game.audio.playMusic('solo');
  game.audio.playMusic('couple');
  // A previous track reporting it finished.
  solo.emit('ended');
  await flush();
  // The game-over screen keeps running frames.
  stepFrames(game, 240);

  assert.equal(solo.playCount, before, 'play() is never called again');
  assert.equal(solo.paused, true, 'the game-over screen stays silent');
  assert.equal(game.audio.music, null);
  assert.equal(game.audio.tracks.get('solo'), solo, 'the element is reused, not recreated');
  assert.equal(solo.listeners.get('ended').length, 1, 'listeners are never duplicated');
});

// ---------------------------------------------------------------------------
// 8. The secret ending is terminal as well.
// ---------------------------------------------------------------------------

test('the Continuará ending stays silent', () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  assert.equal(solo.paused, false, 'the run starts with music');

  assert.equal(game.startEnding(), true, 'the ending begins');
  assert.equal(game.state, 'ending');
  assert.equal(solo.paused, true, 'the ending cuts the music');
  assert.equal(game.audio.musicStopped, true);
  assert.equal(game.audio.music, null);

  const before = solo.playCount;
  game.audio.playMusic('couple');
  stepFrames(game, 240);
  assert.equal(solo.playCount, before, 'nothing restarts during the ending');
  assert.equal(solo.paused, true, 'the final frame is silent');
});

// ---------------------------------------------------------------------------
// 9-10. The music progression and a genuinely new run.
// ---------------------------------------------------------------------------

test('Sin Ti -> reunion silence -> Contigo, without per-frame restarts', () => {
  const game = createGame();
  game.start();
  const solo = game.audio.tracks.get('solo');
  assert.equal(game.audio.music, 'solo');
  assert.equal(solo.paused, false);

  // The reunion scene silences the song (scene-driven pause).
  game.startReunion();
  assert.equal(solo.paused, true, 'the reunion dialogue plays over silence');
  assert.equal(game.audio.music, null, 'the scene forgets the solo intent');

  // The kiss finishes and the couple song takes over.
  game.finishReunion();
  const couple = game.audio.tracks.get('couple');
  assert.equal(game.audio.music, 'couple');
  assert.equal(couple.paused, false, 'Contigo plays after the kiss');
  assert.equal(solo.paused, true, 'the two songs never overlap');

  // The outro asks for the song every frame: it must not re-enter play().
  const before = couple.playCount;
  for (let index = 0; index < 60; index += 1) {
    game.audio.playMusic('couple');
  }
  assert.equal(couple.playCount, before, 'per-frame requests never restart a track');

  // A pause in the couple run holds Contigo and resumes it in place.
  couple.currentTime = 77;
  game.pause();
  assert.equal(couple.paused, true);
  game.resume();
  assert.equal(couple.paused, false, 'Contigo resumes where it was');
  assert.equal(couple.currentTime, 77, 'no rewind');
});

test('starting a new run re-initialises music without duplicates', () => {
  const game = createGame();
  game.start();
  const soloBefore = game.audio.tracks.get('solo');
  const sizeBefore = game.audio.tracks.size;
  const playsAfterFirstStart = soloBefore.playCount;

  // Reach a terminal state, then start again.
  game.lifeOrder = ['boy'];
  game.lives = 1;
  game.lifeGrace = 0;
  game.loseLife(400, 400);
  assert.equal(game.state, 'gameover');
  assert.equal(game.audio.musicStopped, true);

  game.start();
  assert.equal(game.state, 'running');
  assert.equal(game.audio.musicStopped, false, 'the new run clears the terminal stop');
  assert.equal(game.audio.musicHeld, false, 'and any pause hold');
  const solo = game.audio.tracks.get('solo');
  assert.equal(solo, soloBefore, 'the same element is reused');
  assert.equal(game.audio.tracks.size, sizeBefore, 'no elements are duplicated');
  assert.equal(solo.listeners.get('ended').length, 1, 'no listeners are duplicated');
  assert.equal(solo.paused, false, 'the solo theme starts for the new run');
  assert.equal(solo.currentTime, 0, 'a new run rewinds to the opening');
  assert.equal(solo.playCount, playsAfterFirstStart + 1,
    'exactly one fresh play() for the new run');
});
