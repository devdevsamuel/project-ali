import { Input } from './Input.js';
import { Obstacle, COUPLE_VARIANTS } from './Obstacle.js';
import { Rival } from './Rival.js';
import { Robber } from './Robber.js';
import { SignField } from './Signs.js';
import { CommentField } from './Comments.js';
import { REUNION_BEATS } from './dialogue.js';
import { drawDialogueBox } from './dialogueRender.js';
import { Player } from './Player.js';
import { Girl } from './Girl.js';
import { Environment } from './Environment.js';
import { Effects, drawHeart } from './Effects.js';
import { CrystalField } from './Crystal.js';
import { PixelView } from './render.js';
import { NEON } from './palette.js';
import { AudioManager } from './Audio.js';
import { Baby } from './Baby.js';
import { Guerrilla, drawChancleta } from './Guerrilla.js';
import { drawText, measureText } from './font.js';
import {
  ART, GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXELS_PER_METER, PLAYER_X,
  HEART_MIN_DISTANCE, PROGRESS_DISTANCE, CRYSTAL_COUNT,
  REUNION_TRIGGER_AHEAD, REUNION_APPROACH, REUNION_STEP, REUNION_ZOOM_IN,
  OUTRO_STEP_END, OUTRO_KISS_END, OUTRO_PART_END,
  OUTRO_PULLBACK_START, OUTRO_PULLBACK,
  REUNION_CROP_WIDTH, REUNION_CROP_HEIGHT, REUNION_CROP_Y,
  KISS_GAP, GIRL_KISS_STEP, GIRL_WAIT_AHEAD, AWAKEN_SECONDS,
  KISSES_REQUIRED_FOR_BABY, KISS_INSTRUCTION_DELAY, KISS_INSTRUCTION_HOLD,
  KISS_INSTRUCTION_FADE, KISS_INSTRUCTION_TEXT,
  BABY_INTRO_DURATION, BABY_INTRO_FADE, BABY_INTRO_TEXT,
  BITCH_SIGN_PHRASES,
  LIFE_GRACE_SECONDS,
  SURVIVAL_DELAY_MIN, SURVIVAL_DELAY_MAX, SURVIVAL_WARNING_SECONDS,
  SURVIVAL_SECONDS, GUERRILLA_LABEL_TEXT, SURVIVAL_SHOT_SPEED, SURVIVAL_SHOT_UP,
  SURVIVAL_SHOT_HEIGHT, SURVIVAL_SHOT_WIDTH, SURVIVAL_MAX_ENEMIES,
  ENDING_GIRL_X, ENDING_BOY_X, ENDING_ZOOM_SECONDS, ENDING_KISS_AT,
  ENDING_CROP,
  KICK_QUIPS, KICK_ACTIVE_START, KICK_ACTIVE_END, KICK_COOLDOWN_END,
  KICK_HITSTOP, KICK_SHAKE, KICK_SHAKE_DECAY, KICK_SUCCESS_TARGET,
  ROBBER_FIRST_DELAY,
  STARTING_MONEY, ROBBED_MONEY,
  RAIN_INTENSITY_PER_CRYSTAL, RAIN_MAX_INTENSITY,
  SOLO_HAZARD_REACTION_MIN, SOLO_HAZARD_REACTION_RANGE,
  COUPLE_HAZARD_REACTION_MIN, COUPLE_HAZARD_REACTION_RANGE,
} from './config.js';

export { GAME_WIDTH, GAME_HEIGHT };

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp01 = (value) => Math.max(0, Math.min(1, value));
// Mirrors the typewriter speed in dialogueRender.js so the game knows when a
// line is fully revealed and may be advanced.
const DIALOGUE_CHARS_PER_SECOND = 44;
// Idle time after a line is fully revealed before it advances on its own.
// Tuned so one speaker's beats span roughly their recording's length, keeping
// subtitles, animation and audio in step.
const DIALOGUE_IDLE_ADVANCE = 1.2;
// Safety net: if a recording never reports the end (failed load, stalled
// decoder), the scene stops waiting after this many seconds instead of
// hanging on the conversation forever.
const VOICE_WAIT_SAFETY = 14;
const RIVAL_VARIANTS = ['diva', 'snark', 'dash'];

function rectanglesOverlap(first, second) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

/**
 * Flow: run the stormy solo section — rivals to jump or kick, an occasional
 * robber, emotional signs and the five crystals — then reach the girl waiting
 * down the path. The reunion is a dedicated frozen cinematic: he walks over,
 * kneels, they talk through the dialogue beats, then share the animated kiss
 * under a camera cut. Afterwards the couple runs together with a shared double
 * jump while the world transforms into the white colonial city.
 */
export class Game {
  constructor(canvas, {
    onStateChange = () => {},
    onDistanceChange = () => {},
    onHeartsChange = () => {},
    onCrystalsChange = () => {},
    onMoneyChange = () => {},
    onKickCountChange = () => {},
    onKissCountChange = () => {},
    onLivesChange = () => {},
    onNotice = () => {},
  } = {}) {
    this.canvas = canvas;
    this.view = new PixelView(canvas);
    this.onStateChange = onStateChange;
    this.onDistanceChange = onDistanceChange;
    this.onHeartsChange = onHeartsChange;
    this.onCrystalsChange = onCrystalsChange;
    this.onMoneyChange = onMoneyChange;
    this.onKickCountChange = onKickCountChange;
    this.onKissCountChange = onKissCountChange;
    this.onLivesChange = onLivesChange;
    this.onNotice = onNotice;
    this.state = 'start';
    this.lastFrameTime = 0;

    this.environment = new Environment();
    this.effects = new Effects();
    this.crystals = new CrystalField();
    this.signs = new SignField();
    this.comments = new CommentField();
    this.girl = new Girl(GROUND_Y);
    // Centralised audio: sound effects, dialogue voice and the two songs.
    this.audio = new AudioManager();

    this.input = new Input({
      onJump: () => this.handleJump(),
      onPause: () => this.togglePause(),
      onKick: () => this.handleKick(),
      onAdvance: () => this.handleAdvance(),
    });

    this.reset();
    this.resize();

    this.frame = this.frame.bind(this);
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  reset() {
    this.player = new Player(PLAYER_X, GROUND_Y);
    this.girl.reset();
    this.crystals.reset();
    this.environment.resetLife();
    this.hazards = [];
    this.robber = null;
    this.robberTimer = ROBBER_FIRST_DELAY;
    this.robberyDone = false;
    this.hearts = [];
    this.effects.clear();
    this.comments.clear();
    this.distance = 0;
    this.displayedDistance = 0;
    this.heartCount = 0;
    this.money = STARTING_MONEY;
    this.kickCount = 0;
    // Rotates the teasing lines so neighbouring rivals never repeat one.
    this.signPhraseIndex = 0;
    // Completed kisses in couple mode; KISSES_REQUIRED_FOR_BABY bring the baby.
    this.kisses = 0;
    this.baby = null;
    this.babyRevealed = false;
    // The temporary "Benjamin" marker: armed once he has actually joined.
    this.babyIntro = null;
    this.babyIntroDone = false;
    this.coupleHint = null;
    // Family life system: lost in a fixed order — Samuel, Ali, then the baby.
    this.lifeOrder = [];
    this.lives = 0;
    this.lifeGrace = 0;
    // Samuel dying before the baby joins revokes the unlock for this run.
    this.babyLocked = false;
    // Guerrilla survival event: armed only after the baby has joined.
    this.survival = null;
    this.survivalDelay = null;
    this.survivalDelayStarted = false;
    this.guerrillas = [];
    this.survivalShots = [];
    // The secret "Continuará..." ending scene.
    this.endingScene = null;
    // Every rival the runner has already kicked this run. It keeps one kick
    // from counting the same rival twice.
    this.kickedHazards = new Set();
    this.successMessageShown = false;
    this.speed = 340;
    this.spawnDistance = 320;
    this.quietCooldown = false;
    this.heartTimer = 2.2;
    this.scroll = 0;
    this.visualTime = 0;
    this.met = false;
    this.couple = false;
    this.awakenTime = 0;
    this.reunion = null;
    this.coupleKiss = null;
    this.quipIndex = -1;
    this.kickWhiffed = false;
    this.quietCooldown = false;
    this.lastFrameTime = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.onDistanceChange(0);
    this.onHeartsChange(0);
    this.onCrystalsChange(0);
    this.onMoneyChange(this.money);
    this.onKickCountChange(this.kickCount);
    this.onKissCountChange(this.kisses);
    this.onLivesChange(this.lives);
  }

  start() {
    this.reset();
    // A fresh run starts from silence: nothing from the previous attempt
    // keeps playing, then the solo journey theme begins once.
    this.audio.reset();
    this.player.setState('run');
    this.setState('running');
    this.audio.playMusic('solo');
  }

  restart() {
    this.start();
  }

  // Pausing and resuming funnel every input source (button, P/Esc, window
  // blur, tab hidden) through one place, so the music hold always matches
  // the game state. Only background songs are held — dialogue and the kick
  // sound are never touched here.
  pause() {
    if (this.state === 'running') {
      this.setState('paused');
      this.audio.pauseMusicForGame();
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.setState('running');
      // Continues the same track from its saved position, and only when the
      // music is not in a terminal stop for this run.
      this.audio.resumeMusicFromGame();
    }
  }

  togglePause() {
    if (this.state === 'running') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  // One input for both runners after the kiss; he jumps immediately and she
  // answers a beat later. During the frozen reunion the same key advances the
  // dialogue instead.
  handleJump() {
    if (this.state === 'running') {
      // Jump input drives whoever is still alive: normally Samuel leads and
      // Ali answers a beat later; if Samuel has fallen, Ali carries the run.
      const boyAlive = !this.player.dead;
      const girlAlive = this.girl.active && !this.girl.dead;
      let result = false;
      if (boyAlive) {
        result = this.player.jump();
        if (result === 'first') {
          this.effects.jumpPuff(this.player.x + 20, GROUND_Y);
        } else if (result === 'second') {
          this.effects.doubleJump(this.player.x + 20, this.player.y + this.player.height, NEON.pink);
        } else if (result === 'third') {
          // The family's third jump gets its own little celebration.
          this.effects.familyJump(this.player.x + 20, this.player.y + this.player.height);
        }
      }
      if (girlAlive) {
        if (!boyAlive) {
          this.girl.requestJump(0.04);
        } else if (result === 'first') {
          this.girl.requestJump(0.07);
        } else if (result === 'second' || result === 'third') {
          this.girl.requestJump(0.04);
        }
      }
      if (this.baby && !this.baby.dead) {
        // Benjamin jumps with the family: his own first and second jump
        // follow the family's jumps, and the family's third jump (only
        // unlocked once he has joined) never gives him a third.
        const familyJump = boyAlive ? result : 'first';
        if (familyJump === 'first' || familyJump === 'second') {
          this.baby.jump();
        }
      }
    } else if (this.state === 'reunion') {
      this.advanceDialogue();
    } else if (this.state === 'start' || this.state === 'gameover') {
      this.start();
    }
  }

  // The kick is a solo-stage action: it never runs while the couple is
  // together (that was the bug — the solo kick system firing in couple mode).
  // There the same key shares a kiss instead, and it also advances the
  // reunion, but it never starts or restarts a run.
  handleKick() {
    if (this.state === 'running') {
      if (this.couple) {
        // The kiss needs both of them; a fallen family member silences it.
        if (!this.player.dead && !this.girl.dead) {
          this.startCoupleKiss();
        }
        return;
      }
      if (this.player.kick()) {
        this.kickWhiffed = false;
      }
    } else if (this.state === 'reunion') {
      this.advanceDialogue();
    }
    // During a couple kiss the key does nothing: a fresh press after the
    // animation ends starts the next one (Input only fires on a new press).
  }

  handleAdvance() {
    if (this.state === 'reunion') {
      this.advanceDialogue();
    }
  }

  setState(state) {
    this.state = state;
    this.lastFrameTime = 0;
    if (state === 'gameover') {
      this.player.setDefeat();
      this.girl.setDefeat();
      this.effects.defeat(this.player.x + 20, this.player.y + 40);
      // Terminal: silence the run for good (covers the hazard death and the
      // loss of the last life). Only start() can bring music back.
      this.audio.stopMusicForRun();
      // The introduction marker never survives the end of a run.
      this.babyIntro = null;
    }
    this.onStateChange(state);
  }

  announce(message) {
    this.onNotice(message);
  }

  resize() {
    this.view.resize();
    this.render();
  }

  frame(timestamp) {
    const deltaTime = this.lastFrameTime === 0
      ? 0
      : Math.min((timestamp - this.lastFrameTime) / 1000, 0.033);
    this.lastFrameTime = timestamp;

    this.advance(deltaTime);
    this.render();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  advance(deltaTime) {
    // A landed kick freezes the simulation for a couple of frames, so the
    // impact reads as a hit instead of a blur. The kick animation itself
    // keeps running, otherwise the runner would stay frozen in the kick
    // pose for the whole hit-stop.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - deltaTime);
      this.player.update(deltaTime);
      if (this.state !== 'paused') {
        this.updateVisual(deltaTime * 0.15);
      }
      return;
    }
    if (this.state === 'running') {
      this.update(deltaTime);
    }
    // Dev-only attract mode plays through the cinematic on its own.
    if (this.state === 'reunion' && this.autopilot) {
      this.advanceDialogue();
    }
    // Poses, particles, weather and the reunion cinematic keep breathing on
    // the start and game-over screens; pausing freezes the whole scene.
    if (this.state !== 'paused') {
      this.updateVisual(deltaTime);
    }
  }

  // 0 = the turbulent solo storm, 1 = the awakened white city. The fourth
  // crystal is what starts the transformation, so the colonial streets are
  // already rising while she waits down the path.
  get mood() {
    if (!this.crystals.complete) {
      return 0;
    }
    return Math.min(1, this.awakenTime / AWAKEN_SECONDS);
  }

  update(deltaTime) {
    if (this.state !== 'running' || deltaTime <= 0) {
      return;
    }

    const travelDistance = this.speed * deltaTime;
    this.runAutopilot();

    const wasGrounded = this.player.grounded;
    this.player.update(deltaTime);
    if (!wasGrounded && this.player.grounded) {
      this.effects.landing(this.player.x + 20, GROUND_Y);
    }
    this.scroll += travelDistance;

    // She waits ahead on the world plane until the reunion begins.
    if (this.girl.mode === 'wait') {
      this.girl.update(deltaTime, this.player, travelDistance);
    }

    this.updateHazards(travelDistance, deltaTime);
    if (this.state !== 'running') {
      return;
    }
    this.updateRobber(deltaTime);
    if (this.state !== 'running') {
      return;
    }
    this.updateKick();
    this.updateCrystals();
    this.updateHearts(deltaTime, travelDistance);

    if (this.couple) {
      const girlWasAirborne = !this.girl.grounded;
      const girlDoubleBefore = this.girl.doubleFlash;
      this.girl.update(deltaTime, this.player, travelDistance);
      if (!girlWasAirborne && !this.girl.grounded) {
        this.effects.jumpPuff(this.girl.x + 18, GROUND_Y);
      } else if (girlDoubleBefore === 0 && this.girl.doubleFlash > 0) {
        this.effects.doubleJump(this.girl.x + 18, this.girl.y + this.girl.height, NEON.lavender);
      }
    }

    // The family's newest member trots along with them; the instruction sign
    // counts its delay only while the couple actually runs.
    if (this.baby && !this.baby.dead) {
      // The road speed keeps his arrival in sync with the scrolling world.
      this.baby.update(deltaTime, this.speed);
      // The introduction marker only starts once he has really joined the
      // running group, and it never repeats during the same run.
      if (this.baby.state === 'run' && !this.babyIntro && !this.babyIntroDone) {
        this.babyIntro = { t: 0 };
      }
    }
    if (this.babyIntro) {
      this.babyIntro.t += deltaTime;
      if (this.babyIntro.t >= BABY_INTRO_DURATION + BABY_INTRO_FADE) {
        this.babyIntro = null;
        this.babyIntroDone = true;
      }
    }
    if (this.coupleHint) {
      this.coupleHint.t += deltaTime;
      if (this.coupleHint.t > KISS_INSTRUCTION_DELAY + KISS_INSTRUCTION_HOLD + KISS_INSTRUCTION_FADE) {
        this.coupleHint = null;
      }
    }

    // Life grace: a single overlap or volley costs at most one life.
    if (this.lifeGrace > 0) {
      this.lifeGrace = Math.max(0, this.lifeGrace - deltaTime);
    }

    // Once the baby has actually joined the run, a short random delay arms
    // the guerrilla survival event. The delay and the encounter only ever
    // tick as real game time inside this loop — never per rendered frame.
    if (this.baby && this.baby.state === 'run' && !this.survivalDelayStarted) {
      this.survivalDelayStarted = true;
      this.survivalDelay = SURVIVAL_DELAY_MIN
        + Math.random() * (SURVIVAL_DELAY_MAX - SURVIVAL_DELAY_MIN);
    }
    if (this.survivalDelay !== null) {
      this.survivalDelay -= deltaTime;
      if (this.survivalDelay <= 0) {
        this.survivalDelay = null;
        this.startSurvival();
      }
    }
    this.updateSurvival(deltaTime);
    if (this.state !== 'running') {
      return; // the ending or a game over took over this frame
    }

    this.updateReunionTrigger();

    this.distance += travelDistance / PIXELS_PER_METER;
    const wholeMeters = Math.floor(this.distance);
    if (wholeMeters !== this.displayedDistance) {
      this.displayedDistance = wholeMeters;
      this.onDistanceChange(wholeMeters);
    }
  }

  runAutopilot() {
    if (!this.autopilot) {
      return;
    }
    // Dev-only attract mode (?demo): while airborne over a rival, throw a
    // kick for flair — the jump has already guaranteed clearance, and the
    // knock reads nicely in recordings.
    if (!this.player.grounded && this.player.kickTime >= KICK_COOLDOWN_END) {
      const rival = this.hazards.find((hazard) => hazard.kickable && !hazard.knocked
        && hazard.x > this.player.x - 10 && hazard.x - this.player.x < 80);
      if (rival) {
        this.handleKick();
        return;
      }
    }
    if (!this.player.grounded) {
      return;
    }
    // Hop the next hazard, then the high gems.
    const next = this.hazards.find((hazard) => hazard.x + hazard.width > this.player.x);
    if (next && next.x - this.player.x < 150) {
      this.handleJump();
      return;
    }
    const crystal = this.crystals.nextAhead(this.distance);
    if (crystal && crystal.height > 90) {
      const x = this.crystals.screenX(crystal, this.distance);
      if (x > this.player.x && x - this.player.x < 170) {
        this.handleJump();
      }
    }
  }

  // Solo hazards are kickable rival characters; once they are together the
  // road is lined with props instead, which the kick leaves untouched.
  updateHazards(travelDistance, deltaTime) {
    // Before the reunion the road stays quiet while a crystal is on screen and
    // for the whole thief encounter, so a jump for a gem is never compounded
    // by a hazard landing on top of it — and once every crystal is collected
    // the path to her stays clear. Afterwards hazards resume as street props.
    const solo = !this.met && !this.reunion;
    const quiet = solo && !this.crystals.complete
      && (this.crystals.blocksHazards(this.distance) || this.robber !== null);
    if (!solo || this.crystals.complete) {
      this.quietCooldown = false;
    } else if (quiet) {
      this.quietCooldown = true;
    } else if (this.quietCooldown) {
      // The window just cleared: guarantee a full reaction gap afterwards.
      this.quietCooldown = false;
      this.spawnDistance = Math.max(this.spawnDistance, this.getNextHazardGap());
    }

    // No new street props while the guerrilla event owns the road: the
    // encounter is the only threat for those five seconds.
    if (!quiet && !(solo && this.crystals.complete) && !this.survival) {
      this.spawnDistance -= travelDistance;
      if (this.spawnDistance <= 0) {
        this.spawnHazard();
        this.spawnDistance += this.getNextHazardGap();
      }
    }

    for (const hazard of this.hazards) {
      hazard.update(travelDistance, deltaTime);
    }
    this.hazards = this.hazards.filter(
      (hazard) => !hazard.remove && hazard.x + hazard.width > -80,
    );

    // While the runner is committed to a kick he cannot be hit: the kick
    // either sweeps the rival away or the rival passes through him.
    if (this.player.kickGuard) {
      return;
    }
    // Any living family member in the way costs a life — always consumed
    // from the front of the death order by loseLife().
    const family = this.familyBounds();
    for (const hazard of this.hazards) {
      const bounds = hazard.getBounds();
      if (!bounds || !family.some((box) => rectanglesOverlap(box, bounds))) {
        continue;
      }
      // A kicking leg sweeps the rival out of the way before it can hit the
      // runner, so a well-timed kick is never punished by the contact.
      if (this.kickSweepsHazard(hazard)) {
        continue;
      }
      if (this.couple) {
        this.loseLife(hazard.x + hazard.width / 2, bounds.y + bounds.height / 2);
      } else {
        this.setState('gameover');
      }
      return;
    }
  }

  // True while the kick's active window is over this hazard. The kick is
  // resolved in updateKick() right after this check, so the rival is knocked
  // away on the same frame instead of ending the run.
  kickSweepsHazard(hazard) {
    if (!hazard.kickable || hazard.knocked) {
      return false;
    }
    const kickBounds = this.player.getKickBounds();
    if (!kickBounds) {
      return false;
    }
    const bounds = hazard.getBounds();
    return !!bounds && rectanglesOverlap(kickBounds, bounds);
  }

  spawnHazard() {
    const x = GAME_WIDTH + 30;
    if (this.met) {
      const pick = COUPLE_VARIANTS[Math.floor(Math.random() * COUPLE_VARIANTS.length)];
      this.hazards.push(new Obstacle(x, GROUND_Y, pick.width, pick.height, pick.variant));
      return;
    }
    const variant = RIVAL_VARIANTS[Math.floor(Math.random() * RIVAL_VARIANTS.length)];
    const rival = new Rival(x, GROUND_Y, variant);
    // One teasing line per kickable rival, assigned exactly once at spawn and
    // rotated through the list so the comments stay varied. The sign lives on
    // the entity: it follows her, dies with her, and never re-creates itself.
    rival.sign = {
      text: BITCH_SIGN_PHRASES[this.signPhraseIndex % BITCH_SIGN_PHRASES.length],
      phase: Math.random() * 6.28,
      lines: null,
    };
    this.signPhraseIndex += 1;
    this.hazards.push(rival);
  }

  // The kick: resolve the active window against every hazard. Rivals tumble
  // away with a big comment, a burst of impact and a short hit-stop; props
  // just absorb the hit.
  updateKick() {
    const player = this.player;

    // The motion trail follows the kicking foot while the leg snaps out.
    if (player.state === 'kick' && player.kickTime >= KICK_ACTIVE_START
      && player.kickTime <= KICK_ACTIVE_END) {
      const foot = player.getKickFoot();
      if (foot) {
        this.effects.kickTrail(foot.x, foot.y, 320, 0);
      }
    }

    const kickBounds = player.getKickBounds();
    if (kickBounds) {
      for (const hazard of this.hazards) {
        const bounds = hazard.getBounds();
        if (!bounds || !rectanglesOverlap(kickBounds, bounds)) {
          continue;
        }
        if (hazard.kickable && !hazard.knocked && hazard.hit()) {
          player.kickConnected = true;
          const impactX = bounds.x + bounds.width / 2;
          const impactY = bounds.y + bounds.height / 2;
          this.effects.kickImpactBig(impactX, impactY);
          // The kick sound fires here, on the impact itself — never on the
          // key press, never on a whiff, and once per landed hit.
          this.audio.kick();
          // A brief freeze and a screen shake make the hit land.
          this.hitStop = KICK_HITSTOP;
          this.shake = KICK_SHAKE;
          this.showQuip(impactX, impactY);
          this.countKickSuccess(hazard);
        }
      }
    }
    if (player.state === 'kick'
      && player.kickTime >= KICK_ACTIVE_END
      && !player.kickConnected
      && !this.kickWhiffed) {
      this.kickWhiffed = true;
      this.effects.kickWhiff(this.player.x + this.player.width + 4, this.player.y + this.player.height - 24);
    }
  }

  // Quips rotate without ever repeating back to back. Each one is shown as a
  // large comment right next to the impact.
  showQuip(x, y) {
    let index = Math.floor(Math.random() * KICK_QUIPS.length);
    if (index === this.quipIndex) {
      index = (index + 1) % KICK_QUIPS.length;
    }
    this.quipIndex = index;
    const text = KICK_QUIPS[index];
    this.announce(text);
    // The comment pops above the impact, clear of the two fighters.
    this.comments.push(text, x, y - 44, {
      scale: 1.5,
      life: 1.0,
      color: NEON.white,
      accent: NEON.hotPink,
    });
  }

  // One successful kick counts once, no matter how many frames the hitbox
  // overlaps the same rival.
  countKickSuccess(hazard) {
    if (this.kickedHazards.has(hazard)) {
      return;
    }
    this.kickedHazards.add(hazard);
    this.kickCount += 1;
    this.onKickCountChange(this.kickCount);
    if (this.kickCount >= KICK_SUCCESS_TARGET && !this.successMessageShown) {
      this.successMessageShown = true;
      // The celebration sits above the runner, clear of the action.
      this.comments.push('¡Súper exitoso!', this.player.x + this.player.width / 2, this.player.y - 54, {
        scale: 2,
        life: 1.6,
        color: NEON.lime,
        accent: NEON.lime,
        rise: 22,
      });
      this.announce('¡Súper exitoso!');
    }
  }

  // The theft: a small thief slips in from behind, demands the wallet, takes
  // the money and runs off. He is unarmed and harmless — the encounter never
  // deals damage and never blocks the road — it only costs the player cash.
  updateRobber(deltaTime) {
    // The encounter fires once and never again.
    if (this.robberyDone) {
      this.robber = null;
      return;
    }
    if (!this.robber) {
      this.robberTimer -= deltaTime;
      // The encounter waits until the road has started, so it never lands on
      // the very first frame of the run.
      const ready = this.distance > 0;
      if (this.robberTimer <= 0 && ready) {
        this.robber = new Robber(GROUND_Y);
        this.robber.start(this.player.x);
        this.announce('¡Eh! Un ladrón te viene detrás.');
      }
      return;
    }

    const event = this.robber.update(deltaTime, this.player.x);
    if (event === 'steal') {
      // The wallet is gone: the balance drops and turns red.
      this.money = ROBBED_MONEY;
      this.onMoneyChange(this.money);
      this.effects.coinBurst(this.player.x + 20, this.player.y + 30);
      this.comments.push('¡Me robó!', this.player.x + this.player.width / 2, this.player.y - 46, {
        scale: 1.4,
        life: 1.2,
        color: '#FF5A5A',
        accent: '#FF5A5A',
      });
      this.announce('¡Me robó! -$120');
    }
    if (event === 'done') {
      this.robber = null;
      this.robberyDone = true;
    }
  }

  updateCrystals() {
    const family = this.familyBounds();
    for (const entry of this.crystals.entries) {
      if (entry.collected) {
        continue;
      }
      const x = this.crystals.screenX(entry, this.distance);
      if (x < -70 || x > GAME_WIDTH + 70) {
        continue;
      }
      const bounds = this.crystals.boundsOf(entry, this.distance, this.visualTime);
      if (family.some((box) => rectanglesOverlap(box, bounds)) && this.crystals.collect(entry)) {
        const bob = Math.sin(this.visualTime * 2 + entry.phase) * 5;
        this.effects.crystalCollect(x, GROUND_Y - entry.height + bob, entry.core.main);
        this.onCrystalsChange(this.crystals.collected);
        // Every crystal turns the rain up a notch. The weather eases into the
        // new intensity, so the storm builds instead of snapping.
        this.updateRainIntensity();
        if (this.crystals.complete) {
          this.announce('Los cinco cristales. Ella te espera más adelante.');
        } else {
          this.announce(`Cristal ${this.crystals.collected} de ${CRYSTAL_COUNT}.`);
        }
      }
    }
    // Missed crystals come back later instead of blocking the reunion.
    this.crystals.reschedulePassed(this.distance);
  }

  // The storm gets heavier as the crystals come in. From the second gem on
  // the rain is clearly stronger, and it keeps building to the last crystal.
  updateRainIntensity() {
    const collected = this.crystals.collected;
    if (collected < 2) {
      this.environment.setRainIntensity(0);
      return;
    }
    const level = Math.min(
      RAIN_MAX_INTENSITY,
      RAIN_INTENSITY_PER_CRYSTAL * (collected - 1),
    );
    this.environment.setRainIntensity(level);
  }

  updateHearts(deltaTime, travelDistance) {
    this.heartTimer -= deltaTime;
    if (this.heartTimer <= 0 && this.distance >= HEART_MIN_DISTANCE && this.hearts.length < 3) {
      this.heartTimer = 1.7 + Math.random() * 1.4;
      this.hearts.push({
        x: GAME_WIDTH + 20,
        y: GROUND_Y - (96 + Math.random() * 54),
        phase: Math.random() * 6.28,
      });
    }

    const family = this.familyBounds();
    for (const heart of this.hearts) {
      heart.x -= travelDistance;
      const bounds = { x: heart.x, y: heart.y, width: 16, height: 16 };
      if (!heart.collected && family.some((box) => rectanglesOverlap(box, bounds))) {
        heart.collected = true;
        this.heartCount += 1;
        this.onHeartsChange(this.heartCount);
        this.effects.collect(heart.x + 8, heart.y + 8);
      }
    }
    this.hearts = this.hearts.filter((heart) => !heart.collected && heart.x > -40);
  }

  updateReunionTrigger() {
    if (this.met || this.reunion) {
      return;
    }
    if (!this.girl.active && this.crystals.complete) {
      this.girl.placeAhead(PLAYER_X + GIRL_WAIT_AHEAD);
      this.announce('Ella está justo adelante. Sigue corriendo.');
    }
    if (this.girl.mode === 'wait') {
      const gap = this.girl.x - (this.player.x + this.player.width / 2);
      if (gap <= REUNION_TRIGGER_AHEAD) {
        this.startReunion();
      }
    }
  }

  /**
   * The reunion cinematic — a dedicated frozen state. Phases:
   *  approach  he jogs the last steps toward her while the camera cuts in;
   *  dialogue  he kneels and the beats play (jump / kick / Enter advances);
   *  outro     she steps closer, they share the animated kiss, then part and
   *            the camera pulls back into the running game.
   */
  startReunion() {
    const girlX = this.girl.x;
    this.player.landNow();
    this.girl.beginReunion();
    this.player.setState('surprise');
    this.girl.setState('greet');
    // The solo theme stops here and stays off through the conversation and
    // the kiss, so the voice recordings play alone.
    this.audio.pauseMusic();
    // Final kiss positions: she steps toward him, he closes the rest, and the
    // two centres end exactly KISS_GAP apart so their faces connect.
    const girlKissX = girlX + GIRL_KISS_STEP;
    this.reunion = {
      phase: 'approach',
      t: 0,
      zoom: 0,
      startX: this.player.x,
      kneelX: this.player.x + REUNION_STEP,
      girlStartX: girlX,
      girlKissX,
      kissX: girlKissX - KISS_GAP - 2,
      beatIndex: -1,
      beatTime: 0,
      // Each speaker's recording plays once per turn; the scene holds the
      // next speaker (or the outro) until it has finished.
      voiceStarted: {},
      voiceWait: 0,
      voiceBlocked: false,
      kissFired: false,
      cheerFired: false,
      outroT: 0,
    };
    this.setState('reunion');
    // Softer blend while the cinematic plays out.
    this.player.poseBlendRate = 12;
    this.girl.poseBlendRate = 12;
    this.announce('Ellos se encuentran.');
  }

  updateReunion(deltaTime) {
    const scene = this.reunion;
    if (!scene) {
      return;
    }

    if (scene.phase === 'approach') {
      scene.t += deltaTime;
      const t = clamp01(scene.t / REUNION_APPROACH);
      this.player.x = lerp(scene.startX, scene.kneelX, easeInOut(t));
      this.player.setState('run');
      this.girl.setState(t > 0.55 ? 'idle' : 'greet');
      if (scene.t >= Math.max(REUNION_APPROACH, REUNION_ZOOM_IN)) {
        this.beginDialogue();
      }
      return;
    }

    if (scene.phase === 'dialogue') {
      scene.beatTime += deltaTime;
      const beat = REUNION_BEATS[scene.beatIndex];
      if (beat) {
        const revealed = Math.floor(Math.max(0, scene.beatTime - 0.12) * DIALOGUE_CHARS_PER_SECOND);
        const textDone = revealed >= Array.from(beat.line).length;
        // Hold the next speaker (or the end of the conversation) until the
        // current recording has actually finished, so nothing is cut off.
        let blocked = this.voiceBlocksAdvance(scene);
        if (blocked) {
          scene.voiceWait += deltaTime;
          if (scene.voiceWait > VOICE_WAIT_SAFETY) {
            this.audio.stopVoice();
            blocked = false;
          }
        } else {
          scene.voiceWait = 0;
        }
        scene.voiceBlocked = blocked;
        if (beat.auto) {
          if (scene.beatTime >= beat.hold && !blocked) {
            this.nextBeat();
          }
        } else if (textDone && scene.beatTime >= beat.hold + DIALOGUE_IDLE_ADVANCE && !blocked) {
          // No input: keep the scene moving on its own.
          this.nextBeat();
        }
      }
      return;
    }

    // Outro: stand, step, kiss, part — with the camera pulling back at the
    // end. Positions are eased the whole way so nothing teleports.
    scene.outroT += deltaTime;
    const t = scene.outroT;
    // First he rises from the kneel, then the lean begins: a short stand
    // beat keeps the transition from popping straight into the kiss.
    const standEnd = 0.16;
    const kissT = clamp01((t - standEnd) / Math.max(0.001, OUTRO_STEP_END - standEnd));
    this.player.kissT = kissT;
    this.girl.kissT = kissT;

    if (t < OUTRO_KISS_END) {
      const stepT = easeInOut(clamp01(t / OUTRO_STEP_END));
      this.player.x = lerp(scene.kneelX, scene.kissX, stepT);
      this.girl.x = lerp(scene.girlStartX, scene.girlKissX, stepT);
      if (t < standEnd) {
        this.player.setState('idle');
        this.girl.setState('idle');
      } else {
        this.player.setState('kiss');
        this.girl.setState('kiss');
      }
      if (t >= OUTRO_STEP_END) {
        this.kissSparkleTick(scene, deltaTime);
      }
    } else if (t < OUTRO_PART_END) {
      // The kiss animation has finished: the reunion song takes over and
      // keeps running through the couple's run. Calling this every frame of
      // the phase is safe — the manager ignores repeats.
      this.audio.playMusic('couple');
      this.player.kissT = 0;
      this.girl.kissT = 0;
      this.player.setState('cheer');
      const phase = (t - OUTRO_KISS_END) / Math.max(0.001, OUTRO_PART_END - OUTRO_KISS_END);
      // They swap sides (she ends up behind him), so her return leads with a
      // fast-out curve while he eases back: the crossing is quick instead of
      // a slow merge of the two sprites.
      const boySettle = easeInOut(phase);
      const girlSettle = 1 - (1 - phase) ** 2;
      this.player.x = lerp(scene.kissX, PLAYER_X, boySettle);
      this.girl.x = lerp(scene.girlKissX, PLAYER_X - 46, girlSettle);
      if (phase < 0.4) {
        this.girl.setState('cheer');
        if (!scene.cheerFired) {
          scene.cheerFired = true;
          this.effects.meetBurst(this.player.x + 40, this.player.y + 40);
        }
      } else {
        this.girl.setState('run');
      }
    } else {
      this.finishReunion();
    }
  }

  beginDialogue() {
    const scene = this.reunion;
    scene.phase = 'dialogue';
    scene.beatIndex = -1;
    this.nextBeat();
  }

  nextBeat() {
    const scene = this.reunion;
    scene.beatIndex += 1;
    scene.beatTime = 0;
    if (scene.beatIndex >= REUNION_BEATS.length) {
      scene.phase = 'outro';
      scene.outroT = 0;
      this.clearDialogueFaces();
      // The conversation is over: no recording follows them into the kiss.
      this.audio.stopVoice();
      return;
    }
    this.applyBeat(REUNION_BEATS[scene.beatIndex]);
  }

  // The player may advance a beat with jump, kick or Enter — never the beat
  // where she keeps her silence on purpose.
  // The next beat depends on the current recording only when the speaker
  // changes or the conversation ends — text within one speaker's turn moves
  // at its own rhythm, but a voice is never cut off mid-sentence.
  voiceBlocksAdvance(scene) {
    const current = REUNION_BEATS[scene.beatIndex];
    const next = REUNION_BEATS[scene.beatIndex + 1];
    if (next && current && next.speaker === current.speaker) {
      return false;
    }
    return !this.audio.isVoiceIdle();
  }

  advanceDialogue() {
    const scene = this.reunion;
    if (!scene || scene.phase !== 'dialogue') {
      return;
    }
    const beat = REUNION_BEATS[scene.beatIndex];
    if (!beat || beat.auto || scene.beatTime < beat.hold) {
      return;
    }
    const revealed = Math.floor(Math.max(0, scene.beatTime - 0.12) * DIALOGUE_CHARS_PER_SECOND);
    if (revealed < Array.from(beat.line).length) {
      return;
    }
    // Manual advance respects the recording too: pressing Continue during the
    // other character's line waits instead of skipping over their voice.
    if (this.voiceBlocksAdvance(scene)) {
      return;
    }
    this.nextBeat();
  }

  applyBeat(beat) {
    this.player.setState(beat.boy.state);
    this.player.faceOverride = beat.boy.face ?? null;
    this.player.speaking = beat.speaker === 'boy' && !!beat.line;
    this.girl.setState(beat.ali.state);
    this.girl.faceOverride = beat.ali.face ?? null;
    this.girl.speaking = beat.speaker === 'ali' && !!beat.line;
    // One recording per speaker per conversation: later beats of the same
    // turn never restart it, and the manager never overlaps two voices.
    const scene = this.reunion;
    if (beat.line && scene && !scene.voiceStarted[beat.speaker]) {
      scene.voiceStarted[beat.speaker] = true;
      this.audio.speak(beat.speaker);
    }
  }

  clearDialogueFaces() {
    this.player.faceOverride = null;
    this.player.speaking = false;
    this.girl.faceOverride = null;
    this.girl.speaking = false;
  }

  finishReunion() {
    this.reunion = null;
    this.met = true;
    this.couple = true;
    this.player.together = true;
    this.player.unlockDoubleJump();
    this.player.kissT = 0;
    this.girl.kissT = 0;
    this.clearDialogueFaces();
    this.player.poseBlendRate = null;
    this.girl.poseBlendRate = null;
    this.audio.stopVoice();
    // Idempotent: guarantees the reunion song is running once they are a
    // couple, even if the scene jumped past the kiss phase.
    this.audio.playMusic('couple');
    this.player.setState('run');
    // The outro eases him back; this guarantees the exact running layout
    // even if the scene was skipped.
    this.player.x = PLAYER_X;
    this.girl.startTogether(this.player.x);
    this.spawnDistance = this.getNextHazardGap();
    // The instruction sign starts its two-second count only now, when the
    // couple run actually begins.
    this.coupleHint = { t: 0 };
    // The family takes the road with two lives, always lost in the fixed
    // order: Samuel first, then Ali.
    this.lifeOrder = ['boy', 'ali'];
    this.lives = 2;
    this.onLivesChange(this.lives);
    this.setState('running');
    // One source of truth: the toast and the instruction sign share the text.
    this.announce(KISS_INSTRUCTION_TEXT);
  }

  // The couple's own kiss: pressing X while they run together freezes the
  // world exactly like the reunion scene, both turn toward each other and
  // play the same kiss animation, then the run resumes from the exact spot
  // they stopped at. It never touches the dialogue, the reunion or the music.
  startCoupleKiss() {
    if (this.state !== 'running' || !this.couple || this.coupleKiss) {
      return false;
    }
    this.coupleKiss = { t: 0, kissFired: false };
    this.setState('couplekiss');
    return true;
  }

  updateCoupleKiss(deltaTime) {
    const scene = this.coupleKiss;
    if (!scene) {
      return;
    }
    scene.t += deltaTime;
    const t = scene.t;
    // Same curve as the reunion outro: a short beat to turn, then the lean.
    const kissT = clamp01((t - 0.16) / Math.max(0.001, OUTRO_STEP_END - 0.16));
    this.player.kissT = kissT;
    this.girl.kissT = kissT;
    if (t < OUTRO_KISS_END) {
      this.player.setState('kiss');
      this.girl.setState('kiss');
      if (t >= OUTRO_STEP_END) {
        this.kissSparkleTick(scene, deltaTime);
      }
    } else {
      this.finishCoupleKiss();
    }
  }

  finishCoupleKiss() {
    this.coupleKiss = null;
    this.player.kissT = 0;
    this.girl.kissT = 0;
    // Straight back into the shared run: same positions, same progress.
    this.player.setState('together');
    this.girl.setState('together');
    this.setState('running');
    // A kiss counts only once it has fully played — never for a key press or
    // an interrupted scene.
    this.kisses += 1;
    this.onKissCountChange(this.kisses);
    if (this.kisses >= KISSES_REQUIRED_FOR_BABY && !this.babyRevealed) {
      this.revealBaby();
    }
  }

  // The kiss that reaches the target brings the baby in from behind: the
  // family gains its third member and, with it, the triple jump. Nothing
  // else resets — the crystals, the music and the run's progress stay as
  // they are. Revoked permanently if Samuel fell before this moment.
  revealBaby() {
    if (this.babyRevealed || this.babyLocked) {
      return;
    }
    this.babyRevealed = true;
    this.baby = new Baby(this.player.x - 92);
    this.player.unlockTripleJump();
    this.girl.unlockTripleJump();
    // The baby joins the life order immediately: he is the third life from
    // the moment he appears, even mid-arrival.
    this.lifeOrder.push('baby');
    this.lives = this.lifeOrder.length;
    this.onLivesChange(this.lives);
    this.effects.meetBurst(this.player.x - 40, GROUND_Y - 46);
    this.announce('¡Llegó el bebé! Ya pueden saltar tres veces.');
  }

  // Shared by the reunion outro and the couple's mid-run kiss: one sparkle
  // burst when the kiss lands, then a light shimmer while they hold it.
  kissSparkleTick(scene, deltaTime) {
    const midX = (this.player.x + this.player.width / 2 + this.girl.x + this.girl.width / 2) / 2;
    const kissY = this.player.y + 12;
    if (!scene.kissFired) {
      scene.kissFired = true;
      this.effects.kissSparkle(midX, kissY);
    } else if (Math.random() < deltaTime * 2 && this.effects.particles.length < 70) {
      this.effects.kissSparkle(midX + (Math.random() - 0.5) * 44, kissY + Math.random() * 24);
    }
  }

  // --- Family life system (couple stage) ---------------------------------

  // Collision boxes for every living family member. All damage flows
  // through loseLife(), which pops the next character from the fixed death
  // order — Samuel, then Ali, then the baby — so one event can never take
  // two lives and the order can never drift.
  familyBounds() {
    const boxes = [];
    if (!this.player.dead) {
      boxes.push(this.player.getBounds());
    }
    if (this.girl.active && !this.girl.dead) {
      boxes.push(this.girl.getBounds());
    }
    if (this.baby && !this.baby.dead) {
      boxes.push(this.baby.getBounds());
    }
    return boxes;
  }

  loseLife(hitX, hitY) {
    if (this.state !== 'running' || this.lifeGrace > 0 || this.lifeOrder.length === 0) {
      return false;
    }
    const who = this.lifeOrder.shift();
    this.lives = this.lifeOrder.length;
    this.onLivesChange(this.lives);
    this.lifeGrace = LIFE_GRACE_SECONDS;

    if (who === 'boy') {
      this.player.dead = true;
      if (!this.babyRevealed) {
        // Samuel fell before the baby joined: the unlock is revoked for the
        // rest of this run — no later kiss, timer or callback can spawn it.
        this.babyLocked = true;
      }
      this.effects.defeat(this.player.x + 20, this.player.y + 40);
      this.announce('¡Cayó Samuel! La familia sigue.');
    } else if (who === 'ali') {
      this.girl.dead = true;
      this.effects.defeat(this.girl.x + 18, this.girl.y + 36);
      this.announce('¡Cayó Ali!');
    } else {
      this.baby.dead = true;
      this.effects.defeat(this.baby.x + 11, this.baby.y + 16);
      this.babyIntro = null;
      this.announce('¡Cayó el bebé!');
    }

    if (this.lives <= 0) {
      // Normal game over: nothing here can ever reach the special ending.
      this.survival = null;
      this.survivalDelay = null;
      this.guerrillas = [];
      this.survivalShots = [];
      this.setState('gameover');
    }
    return true;
  }

  // --- Guerrilla survival event ------------------------------------------

  // Armed only from the baby's arrival path, once per run: the delay is
  // randomised inside the configured 3–5 s window and only ticks as game
  // time while the couple actually runs.
  startSurvival() {
    if (this.survival || this.state !== 'running' || this.endingScene) {
      return false;
    }
    this.survival = { phase: 'warning', t: 0, elapsed: 0, started: false, milestone: false };
    // Readable cue: a toast, a short jolt and two fighters jogging in from
    // beyond the right edge, far away from the family.
    this.announce('¡Guerrillas! Sobrevive 5 segundos.');
    this.shake = KICK_SHAKE;
    this.spawnGuerrilla(700, 690, SURVIVAL_WARNING_SECONDS + 0.3 + Math.random() * 0.4);
    this.spawnGuerrilla(850, 830, SURVIVAL_WARNING_SECONDS + 0.9 + Math.random() * 0.4);
    for (const guerrilla of this.guerrillas) {
      this.effects.jumpPuff(guerrilla.x + 19, GROUND_Y);
    }
    return true;
  }

  spawnGuerrilla(spawnX, targetX, firstThrowDelay) {
    if (this.guerrillas.length >= SURVIVAL_MAX_ENEMIES) {
      return;
    }
    this.guerrillas.push(new Guerrilla(spawnX, GROUND_Y, targetX, firstThrowDelay));
  }

  updateSurvival(deltaTime) {
    const scene = this.survival;
    if (!scene || this.state !== 'running') {
      return;
    }
    scene.t += deltaTime;

    if (scene.phase === 'warning') {
      // The fighters run in and take their stances; nothing flies yet.
      this.updateGuerrillas(deltaTime);
      if (scene.t >= SURVIVAL_WARNING_SECONDS) {
        scene.phase = 'active';
        scene.started = true;
        // The five-second clock starts exactly here, with the first enemy
        // active — the 3–5 s approach delay is never counted.
        scene.elapsed = 0;
      }
      return;
    }

    scene.elapsed += deltaTime;
    this.updateGuerrillas(deltaTime);
    this.updateSurvivalShots(deltaTime);
    if (!scene.milestone && scene.elapsed >= SURVIVAL_SECONDS) {
      // The five-second challenge is a milestone, not a terminal condition.
      // Surviving it unlocks no ending: the fight keeps going until the
      // centralized life system genuinely ends the run.
      scene.milestone = true;
      this.announce('¡Aguantaste 5 segundos! Los guerrilleros siguen.');
    }
  }

  updateGuerrillas(deltaTime) {
    for (const guerrilla of this.guerrillas) {
      const fired = guerrilla.update(deltaTime);
      for (const shot of fired) {
        this.spawnSurvivalShot(guerrilla);
      }
    }
  }

  spawnSurvivalShot(guerrilla) {
    const originX = guerrilla.x - 10;
    this.survivalShots.push({
      x: originX,
      y: GROUND_Y - SURVIVAL_SHOT_UP,
      width: SURVIVAL_SHOT_WIDTH,
      height: SURVIVAL_SHOT_HEIGHT,
      vx: -SURVIVAL_SHOT_SPEED,
      spin: 0,
      spent: false,
    });
    this.effects.jumpPuff(originX + 6, GROUND_Y - SURVIVAL_SHOT_UP + 6);
  }

  updateSurvivalShots(deltaTime) {
    const family = this.familyBounds();
    for (const shot of this.survivalShots) {
      shot.x += shot.vx * deltaTime;
      shot.spin += deltaTime * 16;
      if (!shot.spent && family.some((box) => rectanglesOverlap(box, shot))) {
        // One projectile is spent on contact, and the grace window keeps any
        // other shot in the same frame from taking a second life.
        shot.spent = true;
        this.loseLife(shot.x + shot.width / 2, shot.y + shot.height / 2);
      }
    }
    this.survivalShots = this.survivalShots.filter(
      (shot) => !shot.spent && shot.x + shot.width > -30,
    );
  }

  // --- Secret "Continuará..." ending -------------------------------------

  // Kept as an explicit terminal transition for the existing ending flow,
  // but the guerrilla survival milestone never calls it. The encounter ends
  // only through the centralized life system, not through its timer.
  startEnding() {
    if (this.state !== 'running' || this.endingScene) {
      return false;
    }
    this.survival = null;
    this.survivalDelay = null;
    this.guerrillas = [];
    this.survivalShots = [];
    this.hazards = [];
    this.coupleHint = null;
    this.babyIntro = null;
    const boyAlive = !this.player.dead;
    const girlAlive = this.girl.active && !this.girl.dead;
    this.endingScene = {
      t: 0,
      kissFired: false,
      startBoyX: this.player.x,
      startGirlX: this.girl.x,
      startBabyX: this.baby ? this.baby.x : 0,
      boyAlive,
      girlAlive,
      // The composition is about the couple; the baby only shows when he is
      // the sole survivor of the chaos.
      showBaby: !(boyAlive && girlAlive) && Boolean(this.baby) && !this.baby.dead,
    };
    this.setState('ending');
    // The secret ending is terminal too: the final frame stays silent until
    // the player starts a genuinely new run.
    this.audio.stopMusicForRun();
    return true;
  }

  // The final frame belongs to Samuel and Ali: the baby steps out of it
  // unless he is the last family member standing.
  endingBabyHidden() {
    return this.state === 'ending' && this.endingScene !== null
      && !this.endingScene.showBaby;
  }

  updateEnding(deltaTime) {
    const scene = this.endingScene;
    if (!scene) {
      return;
    }
    scene.t += deltaTime;
    // Ease the survivors to the centre of the frame...
    const move = easeInOut(clamp01(scene.t / ENDING_ZOOM_SECONDS));
    if (scene.boyAlive) {
      this.player.x = lerp(scene.startBoyX, ENDING_BOY_X, move);
    }
    if (scene.girlAlive) {
      this.girl.x = lerp(scene.startGirlX, ENDING_GIRL_X, move);
    }
    if (scene.showBaby && this.baby) {
      this.baby.x = lerp(scene.startBabyX, ENDING_GIRL_X - 44, move);
    }
    // ...then the same kiss animation the reunion used, once they arrive.
    const kissT = clamp01((scene.t - ENDING_KISS_AT) / 0.6);
    this.player.kissT = kissT;
    this.girl.kissT = kissT;
    if (scene.t >= ENDING_KISS_AT) {
      if (scene.boyAlive && scene.girlAlive) {
        this.player.setState('kiss');
        this.girl.setState('kiss');
        this.kissSparkleTick(scene, deltaTime);
      } else if (scene.boyAlive) {
        this.player.setState('idle');
      } else if (scene.girlAlive) {
        this.girl.setState('idle');
      }
    }
  }

  updateVisual(deltaTime) {
    this.visualTime += deltaTime;
    if (this.crystals.complete) {
      this.awakenTime += deltaTime;
    }
    this.environment.update(deltaTime, this.mood);
    this.environment.life.pullToward(this.player.x + 20, deltaTime);
    this.effects.update(deltaTime);
    this.comments.update(deltaTime);
    this.player.updateVisual(deltaTime);
    this.girl.updateVisual(deltaTime);
    if (this.reunion) {
      this.updateReunion(deltaTime);
    }
    if (this.coupleKiss) {
      this.updateCoupleKiss(deltaTime);
    }
    if (this.state === 'ending') {
      this.updateEnding(deltaTime);
    }

    // The screen shake decays quickly so it punctuates the hit without
    // making the whole run wobble.
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - KICK_SHAKE_DECAY * deltaTime);
      const amount = this.shake * this.shake / KICK_SHAKE;
      this.shakeX = (Math.random() - 0.5) * amount * 2;
      this.shakeY = (Math.random() - 0.5) * amount * 2;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    if (this.met && this.state === 'running' && this.effects.particles.length < 50
      && Math.random() < deltaTime * 0.8) {
      this.effects.ambientHeart(GAME_WIDTH * Math.random(), GROUND_Y - 10);
    }
  }

  getNextHazardGap() {
    // Solo running has more kickable rivals and a tighter cadence; the couple
    // stage keeps the original, readable spacing for the street props.
    if (!this.couple) {
      return this.speed * (SOLO_HAZARD_REACTION_MIN + Math.random() * SOLO_HAZARD_REACTION_RANGE);
    }
    return this.speed * (COUPLE_HAZARD_REACTION_MIN + Math.random() * COUPLE_HAZARD_REACTION_RANGE);
  }

  get progress() {
    return Math.min(1, this.distance / PROGRESS_DISTANCE);
  }

  // Camera cut: eases from the full frame into a 16:9 crop centred on the two
  // of them, then pulls back as the reunion ends. The secret ending gets its
  // own fixed cinematic crop, framed on the couple after they centre up.
  get cameraCrop() {
    if (this.state === 'ending' && this.endingScene) {
      const zoom = easeInOut(clamp01(this.endingScene.t / ENDING_ZOOM_SECONDS));
      if (zoom < 0.02) {
        return null;
      }
      return {
        x: lerp(0, ENDING_CROP.x, zoom),
        y: lerp(0, ENDING_CROP.y, zoom),
        width: lerp(480, ENDING_CROP.width, zoom),
        height: lerp(270, ENDING_CROP.height, zoom),
      };
    }
    const scene = this.reunion;
    if (!scene) {
      return null;
    }
    let target = 0;
    if (scene.phase === 'approach') {
      target = clamp01(scene.t / REUNION_ZOOM_IN);
    } else if (scene.phase === 'dialogue') {
      target = 1;
    } else {
      target = clamp01(1 - (scene.outroT - OUTRO_PULLBACK_START) / OUTRO_PULLBACK);
    }
    scene.zoom = scene.zoom + (target - scene.zoom) * 0.12;
    const zoom = scene.zoom;
    if (zoom < 0.02) {
      return null;
    }
    const bufferWidth = GAME_WIDTH / ART;
    const bufferHeight = GAME_HEIGHT / ART;
    const midX = ((this.player.x + this.player.width / 2) + (this.girl.x + this.girl.width / 2)) / 2;
    return {
      x: lerp(0, midX / ART - REUNION_CROP_WIDTH / 2, zoom),
      y: lerp(0, REUNION_CROP_Y, zoom),
      width: lerp(bufferWidth, REUNION_CROP_WIDTH, zoom),
      height: lerp(bufferHeight, REUNION_CROP_HEIGHT, zoom),
    };
  }

  render() {
    const view = this.view;
    const mood = this.mood;
    view.begin();
    // The shake offsets the whole world, so a landed kick jolts the frame.
    view.shake(this.shakeX, this.shakeY);
    this.environment.drawBack(view, this.scroll, this.progress, mood);
    this.environment.drawGroundLayer(view, this.scroll, this.progress, mood);
    // Emotional traces along the road, behind every character and hazard.
    this.signs.draw(view, this.distance, this.visualTime);

    // She faces him until the couple starts running in the same direction.
    let girlFlip = this.girl.mode === 'wait';
    if (this.reunion) {
      girlFlip = this.reunion.phase !== 'outro' || this.reunion.outroT < OUTRO_PART_END;
    }

    this.girl.drawShadow(view);
    this.player.drawShadow(view);
    if (!this.girl.dead) {
      this.girl.draw(view, { flip: girlFlip });
    }
    if (this.baby && !this.baby.dead && !this.endingBabyHidden()) {
      this.baby.draw(view);
    }
    for (const hazard of this.hazards) {
      hazard.draw(view, this.visualTime);
    }
    for (const guerrilla of this.guerrillas) {
      guerrilla.draw(view);
    }
    // Labels are attached to the live guerrilla entities, so they follow each
    // fighter as he enters and attacks. They stay clear of the HUD and sprites.
    for (const guerrilla of this.guerrillas) {
      this.drawGuerrillaLabel(view, guerrilla, this.guerrillas.indexOf(guerrilla));
    }
    if (this.robber) {
      this.robber.draw(view);
    }
    for (const heart of this.hearts) {
      const bob = Math.sin(this.visualTime * 3 + heart.phase) * 4;
      view.glow(heart.x - 2, heart.y + bob - 2, 20, 20, NEON.pink, 0.12, 2);
      drawHeart(view, heart.x + 2, heart.y + bob + 2, 12, NEON.pink);
      view.rect(heart.x + 4, heart.y + bob, 4, 2, NEON.white);
    }
    this.crystals.draw(view, this.distance, this.visualTime);
    // He faces the direction of travel — except when he turns to her: during
    // the couple's kiss and the final embrace she is on his left, so
    // mirroring him there turns them toward each other instead of kissing
    // empty air.
    if (!this.player.dead) {
      this.player.draw(view, {
        flip: this.state === 'couplekiss'
          || (this.state === 'ending' && this.player.state === 'kiss'),
      });
    }
    for (const shot of this.survivalShots) {
      drawChancleta(view, shot, this.visualTime);
    }
    this.effects.draw(view);
    // The kick comments sit on top of the world, next to the impact.
    this.comments.draw(view);
    this.environment.drawFront(view, this.scroll, mood);

    // Gentle storm illumination, never a hard full-screen flash.
    const flashGlow = this.environment.weather.flashGlow;
    if (flashGlow > 0.002) {
      view.rect(0, 0, GAME_WIDTH, GAME_HEIGHT, '#C8B4FF', flashGlow);
    }
    view.vignette();

    // The cinematic cut, then the dialogue window on top in screen space.
    const crop = this.cameraCrop;
    if (crop) {
      view.cutscene(crop);
    }
    if (this.reunion && this.reunion.phase === 'dialogue') {
      const beat = REUNION_BEATS[this.reunion.beatIndex];
      if (beat) {
        drawDialogueBox(view, beat, this.reunion.beatTime, beat.hold, !this.reunion.voiceBlocked);
      }
    }
    this.drawCoupleHint(view);
    this.drawBabyIntro(view);
    view.present();
  }

  // The pixel instruction sign: two seconds after the couple starts running
  // it appears above the action — clear of the HUD, the characters and the
  // kiss — holds long enough to read, then fades out once.
  drawCoupleHint(view) {
    const hint = this.coupleHint;
    if (!hint) {
      return;
    }
    const delayEnd = KISS_INSTRUCTION_DELAY;
    const holdEnd = delayEnd + KISS_INSTRUCTION_HOLD;
    const fadeEnd = holdEnd + KISS_INSTRUCTION_FADE;
    if (hint.t < delayEnd || hint.t > fadeEnd) {
      return;
    }
    const alpha = hint.t <= holdEnd ? 1 : 1 - (hint.t - holdEnd) / KISS_INSTRUCTION_FADE;
    const text = KISS_INSTRUCTION_TEXT;
    const width = measureText(text, 2) + 34;
    const centerX = GAME_WIDTH / 2;
    const y = 150 + Math.sin(this.visualTime * 1.6) * 2;
    // A hanging wooden plank with corner bolts, like the road signs.
    view.rect(centerX - width / 2, y, width, 34, '#5B3A22', alpha);
    view.rect(centerX - width / 2, y, width, 2, '#7A4E2E', alpha);
    view.rect(centerX - width / 2 + 3, y + 3, width - 6, 28, '#3A2414', alpha);
    view.rect(centerX - width / 2 + 6, y + 7, 3, 3, '#FFE9C9', alpha * 0.7);
    view.rect(centerX + width / 2 - 9, y + 7, 3, 3, '#FFE9C9', alpha * 0.7);
    view.rect(centerX - width / 2 + 6, y + 24, 3, 3, '#FFE9C9', alpha * 0.7);
    view.rect(centerX + width / 2 - 9, y + 24, 3, 3, '#FFE9C9', alpha * 0.7);
    drawText(view, text, centerX, y + 9, {
      unit: 2, color: '#FFE9C9', align: 'center', alpha, shadow: '#1B1230',
    });
  }

  // A permanent marker for an active guerrilla, in the same visual language
  // as Benjamin's introduction: a dark high-contrast plate with a bright
  // border and a chunky arrow pointing at the fighter. The label is derived
  // from the entity every frame, so it cannot outlive or point away from it.
  drawGuerrillaLabel(view, guerrilla, index = 0) {
    const centerX = guerrilla.x + guerrilla.width / 2;
    // A small vertical stagger keeps the two labels readable when both
    // fighters are close together.
    const stagger = index % 2 === 0 ? 0 : 34;
    const labelY = guerrilla.y - 78 - stagger + Math.sin(this.visualTime * 3.2 + guerrilla.phase) * 2;
    const width = measureText(GUERRILLA_LABEL_TEXT, 2) + 20;
    const left = Math.max(4, Math.min(GAME_WIDTH - width - 4, centerX - width / 2));

    // Dark plate with a lime border: readable over storm and bright city.
    view.rect(left, labelY - 7, width, 30, '#150C2E', 0.94);
    view.rect(left, labelY - 7, width, 3, '#B7FF4A');
    view.rect(left, labelY + 20, width, 3, '#B7FF4A');
    view.rect(left, labelY - 7, 3, 30, '#B7FF4A');
    view.rect(left + width - 3, labelY - 7, 3, 30, '#B7FF4A');
    drawText(view, GUERRILLA_LABEL_TEXT, left + width / 2, labelY + 1, {
      unit: 2, color: '#FFF5FC', align: 'center', shadow: '#3A0A28',
    });

    // The arrow always points down at the actual fighter.
    const arrowTop = labelY + 27;
    for (let row = 0; row < 4; row += 1) {
      const half = 9 - row * 2;
      view.rect(centerX - half - 1, arrowTop + row * 3, half * 2 + 3, 3, '#150C2E');
    }
    for (let row = 0; row < 4; row += 1) {
      const half = 8 - row * 2;
      view.rect(centerX - half, arrowTop + row * 3, half * 2, 3, '#B7FF4A');
    }
    view.rect(centerX - 1, arrowTop + 12, 3, 4, '#B7FF4A');
  }

  // Benjamin's introduction marker: a chunky pixel arrow pointing straight
  // at him with his name on a small plate above his head. It follows his
  // live position (so it tracks him through his jump), never covers his
  // face or his parents, and fades out once its short life is over.
  drawBabyIntro(view) {
    const intro = this.babyIntro;
    if (!intro || !this.baby || this.baby.dead) {
      return;
    }
    const alpha = intro.t <= BABY_INTRO_DURATION
      ? 1
      : Math.max(0, 1 - (intro.t - BABY_INTRO_DURATION) / BABY_INTRO_FADE);
    if (alpha <= 0) {
      return;
    }

    const centerX = this.baby.x + this.baby.width / 2;
    // Above his head, with a small bob so it feels alive.
    const labelY = this.baby.y - 74 + Math.sin(this.visualTime * 3.4) * 2;
    const width = measureText(BABY_INTRO_TEXT, 2) + 20;
    const left = Math.max(4, Math.min(GAME_WIDTH - width - 4, centerX - width / 2));

    // Dark plate with a pink border: readable over both the dark storm and
    // the bright colonial street.
    view.rect(left, labelY - 7, width, 30, '#150C2E', 0.9 * alpha);
    view.rect(left, labelY - 7, width, 3, '#FF38B8', alpha);
    view.rect(left, labelY + 20, width, 3, '#FF38B8', alpha);
    view.rect(left, labelY - 7, 3, 30, '#FF38B8', alpha);
    view.rect(left + width - 3, labelY - 7, 3, 30, '#FF38B8', alpha);
    drawText(view, BABY_INTRO_TEXT, left + width / 2, labelY + 1, {
      unit: 2, color: '#FFE9C9', align: 'center', alpha, shadow: '#3A0A28',
    });

    // The arrow: a dark outlined triangle that always points down at him.
    const arrowTop = labelY + 27;
    for (let row = 0; row < 4; row += 1) {
      const half = 9 - row * 2;
      view.rect(centerX - half - 1, arrowTop + row * 3, half * 2 + 3, 3, '#150C2E', alpha);
    }
    for (let row = 0; row < 4; row += 1) {
      const half = 8 - row * 2;
      view.rect(centerX - half, arrowTop + row * 3, half * 2, 3, '#FF38B8', alpha);
    }
    view.rect(centerX - 1, arrowTop + 12, 3, 4, '#FF38B8', alpha);
  }
}
