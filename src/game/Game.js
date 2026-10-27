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
import {
  ART, GAME_WIDTH, GAME_HEIGHT, GROUND_Y, PIXELS_PER_METER, PLAYER_X,
  HEART_MIN_DISTANCE, PROGRESS_DISTANCE, CRYSTAL_COUNT,
  REUNION_TRIGGER_AHEAD, REUNION_APPROACH, REUNION_STEP, REUNION_ZOOM_IN,
  OUTRO_STEP_END, OUTRO_KISS_END, OUTRO_PART_END,
  OUTRO_PULLBACK_START, OUTRO_PULLBACK,
  REUNION_CROP_WIDTH, REUNION_CROP_HEIGHT, REUNION_CROP_Y,
  KISS_GAP, GIRL_KISS_STEP, GIRL_WAIT_AHEAD, AWAKEN_SECONDS,
  KICK_QUIPS, KICK_ACTIVE_START, KICK_ACTIVE_END, KICK_COOLDOWN_END,
  KICK_HITSTOP, KICK_SHAKE, KICK_SHAKE_DECAY, KICK_SUCCESS_TARGET,
  ROBBER_FIRST_DELAY,
  STARTING_MONEY, ROBBED_MONEY,
  RAIN_INTENSITY_PER_CRYSTAL, RAIN_MAX_INTENSITY,
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
 * robber, emotional signs and the four crystals — then reach the girl waiting
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

  pause() {
    if (this.state === 'running') {
      this.setState('paused');
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.setState('running');
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
      const result = this.player.jump();
      if (result === 'first') {
        this.effects.jumpPuff(this.player.x + 20, GROUND_Y);
        if (this.couple) {
          this.girl.requestJump(0.07);
        }
      } else if (result === 'second') {
        this.effects.doubleJump(this.player.x + 20, this.player.y + this.player.height, NEON.pink);
        if (this.couple) {
          this.girl.requestJump(0.04);
        }
      }
    } else if (this.state === 'reunion') {
      this.advanceDialogue();
    } else if (this.state === 'start' || this.state === 'gameover') {
      this.start();
    }
  }

  // The kick is a solo-stage action. It also advances the reunion like the
  // jump key, but it never starts or restarts a run.
  handleKick() {
    if (this.state === 'running') {
      // Once the couple runs together the road is lined with props, so the
      // kick has no target and stays out of the way.
      if (!this.couple && this.player.kick()) {
        this.kickWhiffed = false;
      }
    } else if (this.state === 'reunion') {
      this.advanceDialogue();
    }
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

    if (!quiet && !(solo && this.crystals.complete)) {
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

    const playerBounds = this.player.getBounds();
    // While the runner is committed to a kick he cannot be hit: the kick
    // either sweeps the rival away or the rival passes through him.
    if (this.player.kickGuard) {
      return;
    }
    for (const hazard of this.hazards) {
      const bounds = hazard.getBounds();
      if (!bounds || !rectanglesOverlap(playerBounds, bounds)) {
        continue;
      }
      // A kicking leg sweeps the rival out of the way before it can hit the
      // runner, so a well-timed kick is never punished by the contact.
      if (this.kickSweepsHazard(hazard)) {
        continue;
      }
      this.setState('gameover');
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
    this.hazards.push(new Rival(x, GROUND_Y, variant));
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
    const playerBounds = this.player.getBounds();
    for (const entry of this.crystals.entries) {
      if (entry.collected) {
        continue;
      }
      const x = this.crystals.screenX(entry, this.distance);
      if (x < -70 || x > GAME_WIDTH + 70) {
        continue;
      }
      const bounds = this.crystals.boundsOf(entry, this.distance, this.visualTime);
      if (rectanglesOverlap(playerBounds, bounds) && this.crystals.collect(entry)) {
        const bob = Math.sin(this.visualTime * 2 + entry.phase) * 5;
        this.effects.crystalCollect(x, GROUND_Y - entry.height + bob, entry.core.main);
        this.onCrystalsChange(this.crystals.collected);
        // Every crystal turns the rain up a notch. The weather eases into the
        // new intensity, so the storm builds instead of snapping.
        this.updateRainIntensity();
        if (this.crystals.complete) {
          this.announce('Los cuatro cristales. Ella te espera más adelante.');
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

    const playerBounds = this.player.getBounds();
    for (const heart of this.hearts) {
      heart.x -= travelDistance;
      const bounds = { x: heart.x, y: heart.y, width: 16, height: 16 };
      if (!heart.collected && rectanglesOverlap(playerBounds, bounds)) {
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
      if (!scene.kissFired && t >= OUTRO_STEP_END) {
        scene.kissFired = true;
        this.effects.kissSparkle(
          (this.player.x + this.player.width / 2 + this.girl.x + this.girl.width / 2) / 2,
          this.player.y + 12,
        );
      }
      if (scene.kissFired && Math.random() < deltaTime * 2 && this.effects.particles.length < 70) {
        const midX = (this.player.x + this.player.width / 2 + this.girl.x + this.girl.width / 2) / 2;
        this.effects.kissSparkle(midX + (Math.random() - 0.5) * 44, this.player.y + 12 + Math.random() * 24);
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
    this.setState('running');
    this.announce('Ahora juntos. Pulsa dos veces para el doble salto.');
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
    const minimumReactionTime = 1.05;
    return this.speed * (minimumReactionTime + Math.random() * 0.6);
  }

  get progress() {
    return Math.min(1, this.distance / PROGRESS_DISTANCE);
  }

  // Camera cut: eases from the full frame into a 16:9 crop centred on the two
  // of them, then pulls back as the reunion ends.
  get cameraCrop() {
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
    this.girl.draw(view, { flip: girlFlip });
    for (const hazard of this.hazards) {
      hazard.draw(view, this.visualTime);
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
    // He always faces right — she is on his right through the whole reunion,
    // so mirroring him here would make him kiss empty space.
    this.player.draw(view);
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
    view.present();
  }
}
