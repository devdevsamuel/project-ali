import {
  AUDIO_ASSETS, AUDIO_VOLUMES, VOICE_TARGET_SECONDS, VOICE_RATE_MIN, VOICE_RATE_MAX,
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
  // play yet, so it counts as idle and the scene never dead-locks.
  isVoiceIdle() {
    if (!this.unlocked) {
      return true;
    }
    return this.voice === null && this.pendingVoice === null;
  }

  // Starts a speaker's recording when nothing is playing. If the other
  // character is still talking, the new line is queued instead of cutting
  // them off — recordings never overlap.
  speak(speaker) {
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

  // Exactly one background song at a time; repeated calls while it already
  // plays are ignored, so scene code can call this every frame safely.
  playMusic(name) {
    const element = this.element(name);
    if (!element) {
      return;
    }
    if (this.music === name && !element.paused) {
      this.notifyMusic();
      return;
    }
    this.stopOtherMusic(name);
    if (!this.unlocked) {
      this.pendingMusic = name;
      this.notifyMusic();
      return;
    }
    // The intent is remembered even while the player has music muted, so the
    // pause button can resume the correct song for this moment.
    this.music = name;
    this.duck(this.voice !== null);
    if (this.musicEnabled) {
      tryPlay(element);
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
  reset() {
    for (const element of this.tracks.values()) {
      halt(element);
    }
    this.music = null;
    this.pendingMusic = null;
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
  // current moment instead of restarting an old one.
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
    } else if (this.music && !this.pendingMusic) {
      const element = this.element(this.music);
      if (element && element.paused) {
        tryPlay(element);
      }
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
