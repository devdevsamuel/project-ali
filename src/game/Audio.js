import {
  AUDIO_ASSETS, AUDIO_VOLUMES, VOICE_TARGET_SECONDS, VOICE_RATE_MIN, VOICE_RATE_MAX,
  ENABLE_DIALOGUE_VOICES,
} from './config.js';

// One centralized audio manager: every sound effect, voice line and song goes
// through here so playback never depends on render frames, only one
// background song is ever audible, voice recordings never overlap, and
// loading or autoplay failures stay contained. Native Audio elements only —
// no libraries.

// Dialogue speakers in dialogue.js map to their recordings.
const VOICE_TRACKS = { boy: 'samuel', ali: 'ali' };
const MUSIC_TRACKS = ['solo', 'couple'];
const VOICE_TRACK_NAMES = ['samuel', 'ali'];

function tryPlay(element) {
  try {
    const result = element.play();
    // Autoplay policy or a bad codec must never break the game loop.
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch {
    /* non-fatal */
  }
}

function rewind(element) {
  try {
    element.currentTime = 0;
  } catch {
    /* not seekable yet; playback still starts */
  }
}

function halt(element) {
  try {
    element.pause();
    element.currentTime = 0;
  } catch {
    /* non-fatal */
  }
}

export class AudioManager {
  constructor() {
    this.unlocked = false;
    this.tracks = new Map();
    this.failed = new Set();
    // Intent: which song should be playing right now ('solo' | 'couple' | null).
    this.music = null;
    // Requests made before the browser allowed any audio.
    this.pendingMusic = null;
    this.pendingVoice = null;
    // The one speaker currently playing, and the one queued behind them.
    this.voice = null;
    this.ducked = false;
    // The player's music preference; playback follows it plus the scene's
    // own intent (solo song, silence at the reunion, couple song after).
    this.musicEnabled = true;
    // Music lifecycle: a *temporary hold* (the player paused — the active
    // song keeps its position and may resume) versus a *terminal stop* (game
    // over or the secret ending — nothing may start music again until a new
    // run resets it).
    this.musicHeld = false;
    this.musicStopped = false;
    // Bumped whenever in-flight playback must be invalidated. Every play()
    // promise captures the token and re-checks it on resolution, so audio
    // that starts after a pause/stop is immediately silenced again.
    this.playbackToken = 0;
    // Notified whenever music playback state changes, so the pause button
    // can mirror the real state instead of a cached guess.
    this.onMusicChange = null;

    this.unlock = this.unlock.bind(this);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pointerdown', this.unlock, { once: true });
      window.addEventListener('keydown', this.unlock, { once: true });
    }
  }

  // Browsers block audio until the player interacts with the page. Anything
  // requested before that first gesture starts as soon as it arrives.
  unlock() {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    const music = this.pendingMusic;
    this.pendingMusic = null;
    if (music) {
      this.playMusic(music);
    }
    const voice = this.pendingVoice;
    this.pendingVoice = null;
    if (voice && !this.voice) {
      this.startVoice(voice);
    }
    this.notifyMusic();
  }

  element(name) {
    if (this.failed.has(name)) {
      return null;
    }
    const existing = this.tracks.get(name);
    if (existing) {
      return existing;
    }
    const url = AUDIO_ASSETS[name];
    if (!url || typeof Audio === 'undefined') {
      return null;
    }
    const element = new Audio(url);
    element.preload = 'auto';
    element.loop = MUSIC_TRACKS.includes(name);
    element.volume = AUDIO_VOLUMES[name] ?? 1;
    // Dialogue recordings are coordinated to their target durations with a
    // gentle playback rate: slowed down where it helps, never sped up, and
    // never truncated — the file always plays to its natural end.
    const target = VOICE_TARGET_SECONDS[name];
    if (target) {
      const applyRate = () => {
        if (typeof element.duration === 'number' && element.duration > 0.5) {
          const rate = element.duration / target;
          element.playbackRate = Math.max(VOICE_RATE_MIN, Math.min(VOICE_RATE_MAX, rate));
        }
      };
      element.addEventListener('loadedmetadata', applyRate);
      applyRate();
    }
    element.addEventListener('error', () => {
      if (this.failed.has(name)) {
        return;
      }
      this.failed.add(name);
      if (this.voice === name) {
        this.voice = null;
        this.duck(false);
        this.flushPendingVoice();
      }
      console.warn(`[audio] "${name}" could not be loaded; it will stay silent.`);
    });
    element.addEventListener('ended', () => this.handleEnded(name));
    this.tracks.set(name, element);
    return element;
  }

  // --- Sound effects -------------------------------------------------------

  // One short sound per landed kick. The game calls this at the moment the
  // hitbox connects, so a whiff stays silent and a single hit sounds once.
  kick() {
    if (!this.unlocked || this.failed.has('kick')) {
      return;
    }
    const element = this.element('kick');
    if (!element) {
      return;
    }
    rewind(element);
    tryPlay(element);
  }

  // --- Dialogue voice ------------------------------------------------------

  // True when no recording is audible (or can be): the dialogue uses this to
  // hold the next speaker's line until the current one has finished, so a
  // recording is never cut off. Before the first user gesture nothing can
  // play yet, so it counts as idle and the scene never dead-locks. With the
  // voices switched off it is always idle: the written dialogue then runs at
  // its own rhythm and never waits for audio that will not play.
  isVoiceIdle() {
    if (!ENABLE_DIALOGUE_VOICES) {
      return true;
    }
    if (!this.unlocked) {
      return true;
    }
    return this.voice === null && this.pendingVoice === null;
  }

  // Starts a speaker's recording when nothing is playing. If the other
  // character is still talking, the new line is queued instead of cutting
  // them off — recordings never overlap. With the voices switched off this
  // is a no-op, so the dialogue text, its order and its timing are
  // untouched: only the sound disappears.
  speak(speaker) {
    if (!ENABLE_DIALOGUE_VOICES) {
      return;
    }
    const name = VOICE_TRACKS[speaker] ?? speaker;
    if (this.voice === name) {
      // Same speaker, next line: their recording keeps running.
      return;
    }
    if (this.voice) {
      this.pendingVoice = name;
      return;
    }
    this.startVoice(name);
  }

  startVoice(name) {
    if (!ENABLE_DIALOGUE_VOICES) {
      return;
    }
    const element = this.element(name);
    if (!element) {
      return;
    }
    if (!this.unlocked) {
      this.pendingVoice = name;
      return;
    }
    rewind(element);
    this.voice = name;
    this.duck(true);
    tryPlay(element);
  }

  handleEnded(name) {
    if (VOICE_TRACK_NAMES.includes(name) && this.voice === name) {
      this.voice = null;
      this.duck(false);
      this.flushPendingVoice();
    }
  }

  flushPendingVoice() {
    const next = this.pendingVoice;
    this.pendingVoice = null;
    if (next && !this.voice) {
      this.startVoice(next);
    }
  }

  // The conversation is over (or the scene was left): cut the voice cleanly
  // and forget anything queued behind it.
  stopVoice() {
    const stopping = this.voice;
    this.voice = null;
    this.pendingVoice = null;
    if (stopping) {
      const element = this.tracks.get(stopping);
      if (element) {
        halt(element);
      }
    }
    this.duck(false);
  }

  // --- Background music ----------------------------------------------------

  // Starts `element.play()` and re-validates the world when the promise
  // settles: if the game was paused, muted or ended while the browser was
  // still starting playback, the song is paused again instead of leaking
  // onto a paused or terminal screen. Rejections (autoplay policy) are
  // swallowed here so no promise ever goes unhandled.
  safePlay(element) {
    const token = this.playbackToken;
    let result;
    try {
      result = element.play();
    } catch {
      return;
    }
    if (result && typeof result.then === 'function') {
      result
        .then(() => {
          const stale = token !== this.playbackToken
            || this.musicHeld
            || this.musicStopped
            || !this.musicEnabled;
          if (stale) {
            try {
              element.pause();
            } catch {
              /* non-fatal */
            }
          }
        })
        .catch(() => {
          /* autoplay blocked or interrupted: the explicit resume paths retry */
        });
    }
  }

  // Starts whatever the current music intent is, if every gate allows it.
  // Used by resume paths; never called from the animation loop.
  startIntent() {
    if (!this.music || this.musicHeld || this.musicStopped
      || !this.musicEnabled || !this.unlocked) {
      return;
    }
    const element = this.element(this.music);
    if (element && element.paused) {
      this.safePlay(element);
    }
  }

  // Exactly one background song at a time. Repeated calls with the same name
  // are a true no-op — scene code can ask every frame and play() is never
  // re-entered — and a terminal state rejects the request outright, so no
  // stale timer, callback or animation frame can restart a song.
  playMusic(name) {
    if (this.musicStopped) {
      this.notifyMusic();
      return;
    }
    const element = this.element(name);
    if (!element) {
      return;
    }
    if (this.music === name) {
      this.notifyMusic();
      return;
    }
    this.stopOtherMusic(name);
    if (!this.unlocked) {
      this.pendingMusic = name;
      this.notifyMusic();
      return;
    }
    // The intent is remembered even while the player has music muted or the
    // game is paused, so resuming plays the correct song for this moment.
    this.music = name;
    this.duck(this.voice !== null);
    if (this.musicEnabled && !this.musicHeld) {
      this.safePlay(element);
    }
    this.notifyMusic();
  }

  // Temporary hold: the player paused the game. Only background songs stop,
  // their currentTime is kept so the same position resumes later, and no
  // playback may start until the explicit resume. Voices and sound effects
  // are never touched.
  pauseMusicForGame() {
    if (this.musicHeld) {
      return;
    }
    this.musicHeld = true;
    this.playbackToken += 1;
    for (const name of MUSIC_TRACKS) {
      const element = this.tracks.get(name);
      if (element && !element.paused) {
        try {
          element.pause();
        } catch {
          /* non-fatal */
        }
      }
    }
    this.notifyMusic();
  }

  // The player resumed gameplay: lift the hold and continue the current
  // intent from where it stopped — never from the beginning — and only when
  // this is not a terminal state.
  resumeMusicFromGame() {
    if (!this.musicHeld) {
      return;
    }
    this.musicHeld = false;
    this.playbackToken += 1;
    this.startIntent();
    this.notifyMusic();
  }

  // Terminal stop: the run is over (game over or the secret ending).
  // Pending playback is invalidated, the intent is forgotten, and every
  // song is paused in place. Only reset() — a genuinely new run — clears it.
  stopMusicForRun() {
    if (this.musicStopped) {
      this.notifyMusic();
      return;
    }
    this.musicStopped = true;
    this.playbackToken += 1;
    this.music = null;
    this.pendingMusic = null;
    for (const name of MUSIC_TRACKS) {
      const element = this.tracks.get(name);
      if (element && !element.paused) {
        try {
          element.pause();
        } catch {
          /* non-fatal */
        }
      }
    }
    this.notifyMusic();
  }

  stopOtherMusic(name) {
    for (const other of MUSIC_TRACKS) {
      if (other === name) {
        continue;
      }
      const element = this.tracks.get(other);
      if (element && !element.paused) {
        halt(element);
      }
      if (this.music === other) {
        this.music = null;
      }
    }
  }

  // Pauses whichever song is running and prevents anything from resuming it
  // during the conversation or the kiss.
  pauseMusic() {
    this.music = null;
    this.pendingMusic = null;
    for (const name of MUSIC_TRACKS) {
      const element = this.tracks.get(name);
      if (element && !element.paused) {
        try {
          element.pause();
        } catch {
          /* non-fatal */
        }
      }
    }
    this.notifyMusic();
  }

  // Restarting the run: everything stops and rewinds, so the solo theme can
  // start fresh and no song from the previous attempt leaks into the new one.
  // This is the only place a terminal stop or a pause hold is lifted, so a
  // new run always begins with a clean, playable music state.
  reset() {
    for (const element of this.tracks.values()) {
      halt(element);
    }
    this.music = null;
    this.pendingMusic = null;
    this.musicHeld = false;
    this.musicStopped = false;
    this.playbackToken += 1;
    this.stopVoice();
    this.notifyMusic();
  }

  // --- Music pause button --------------------------------------------------

  // What the button should show right now: is a song actually audible?
  musicState() {
    const element = this.music ? this.tracks.get(this.music) : null;
    return {
      enabled: this.musicEnabled,
      playing: this.musicEnabled && !!this.music && !!element && !element.paused,
      held: this.musicHeld,
      stopped: this.musicStopped,
    };
  }

  notifyMusic() {
    if (typeof this.onMusicChange === 'function') {
      this.onMusicChange(this.musicState());
    }
  }

  // The player's mute toggle. It only touches the two background songs —
  // dialogue recordings and the kick sound are never affected — and it keeps
  // the scene's intent, so re-enabling resumes the right song for the
  // current moment instead of restarting an old one. It never overrides a
  // pause hold or a terminal stop.
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      for (const name of MUSIC_TRACKS) {
        const element = this.tracks.get(name);
        if (element && !element.paused) {
          try {
            element.pause();
          } catch {
            /* non-fatal */
          }
        }
      }
    } else {
      this.playbackToken += 1;
      this.startIntent();
    }
    this.notifyMusic();
    return this.musicEnabled;
  }

  // Speech stays intelligible: the background music dips while a recording
  // plays and comes back up afterwards.
  duck(active) {
    if (this.ducked === active) {
      return;
    }
    this.ducked = active;
    for (const name of MUSIC_TRACKS) {
      const element = this.tracks.get(name);
      if (element) {
        element.volume = (AUDIO_VOLUMES[name] ?? 1) * (active ? 0.35 : 1);
      }
    }
  }
}
