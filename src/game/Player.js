import { BOY_SPEC, computePose, blendPose } from './characterSpec.js';
import { drawCharacter } from './characterRender.js';
import {
  GROUND_Y, KICK_COOLDOWN_END, KICK_END, KICK_ACTIVE_START, KICK_ACTIVE_END,
  KICK_HITBOX, KICK_REACH,
} from './config.js';
import { stepVertical, LAND_DURATION } from './physics.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Player {
  constructor(x, groundY) {
    this.x = x;
    this.groundY = groundY;
    this.width = 40;
    this.height = BOY_SPEC.height;
    this.gravity = 2300;
    this.jumpSpeed = 820;
    this.reset();
  }

  reset() {
    this.y = this.groundY - this.height;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.state = 'idle';
    this.pose = null;
    this.time = 0;
    this.cycle = 0;
    this.airTime = 0;
    this.landTimer = 0;
    this.stateTime = 0;
    this.jumpsUsed = 0;
    this.maxJumps = 1;
    this.doubleFlash = 0;
    this.kissT = 0;
    this.together = false;
    this.blinkTimer = 2;
    this.blink = false;
    this.glance = 0;
    this.faceOverride = null;
    this.speaking = false;
    // Set during the reunion for a softer cinematic blend.
    this.poseBlendRate = null;
    // The kick is ready the moment the run starts.
    this.kickTime = KICK_COOLDOWN_END;
    this.kickConnected = false;
    this.kickPhaseWasActive = false;
    this.kickFromAir = false;
    // While the kick plays it owns the state, so the vertical physics does
    // not steal it.
    this.stateLock = false;
  }

  // Snaps him back onto the ground before a cinematic begins.
  landNow() {
    this.y = this.groundY - this.height;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.jumpsUsed = 0;
    this.airTime = 0;
    this.landTimer = 0;
  }

  // One kick: short wind-up, an active window with its own hitbox, then a
  // recovery that doubles as the cooldown. It never touches getBounds(), so
  // the kick cannot create accidental collisions for normal movement.
  // The kick works on the ground and in mid-air, so it can be thrown during a
  // jump or a double jump.
  kick() {
    if (this.kickTime < KICK_COOLDOWN_END) {
      return false;
    }
    if (this.state === 'defeat') {
      return false;
    }
    this.kickTime = 0;
    this.kickConnected = false;
    this.kickPhaseWasActive = false;
    // The landing already played; a stale timer must not replay it when the
    // kick ends.
    this.landTimer = 0;
    // Remember the air state so the recovery returns to the right animation.
    this.kickFromAir = !this.grounded;
    this.setState('kick');
    return true;
  }

  // The active hitbox, in front of the runner at leg height; null outside the
  // active frames. The box grows with the leg's extension — using the same
  // ease-out as the pose — so a rival is hit on the frame the foot actually
  // reaches him instead of a fixed window that fires early.
  getKickBounds() {
    if (this.state !== 'kick') {
      return null;
    }
    if (this.kickTime < KICK_ACTIVE_START || this.kickTime > KICK_ACTIVE_END) {
      return null;
    }
    const progress = Math.max(0, Math.min(1,
      (this.kickTime - KICK_ACTIVE_START) / (KICK_ACTIVE_END - KICK_ACTIVE_START)));
    const eased = 1 - (1 - progress) ** 3;
    const footX = lerp(8, KICK_REACH, eased);
    const centerX = this.x + this.width / 2;
    const left = this.x + this.width - 12;
    const right = centerX + footX + 10;
    return {
      x: left,
      y: this.y + this.height - KICK_HITBOX.up,
      width: Math.max(8, Math.min(KICK_HITBOX.forward, right - left)),
      height: KICK_HITBOX.height,
    };
  }

  // True while the runner is committed to a kick and cannot be hit. The
  // window covers the wind-up and the active frames, so a kick thrown at a
  // close rival always lands instead of being punished first. It ends with
  // the recovery, when the runner is back in control.
  get kickGuard() {
    return this.state === 'kick' && this.kickTime <= KICK_END;
  }

  // The foot position during the kick, in world units. Used by the motion
  // trail so the streak follows the leg instead of floating in the air.
  getKickFoot() {
    if (!this.pose) {
      return null;
    }
    const foot = this.pose.legs.front.foot;
    const centerX = this.x + this.width / 2;
    return {
      x: centerX + foot.x * this.pose.squashX,
      y: (this.y + this.height) + foot.y * this.pose.squashY,
    };
  }

  // After the reunion both jumps belong to the couple; the counter still
  // tracks them per character so landing resets stay honest.
  unlockDoubleJump() {
    this.maxJumps = 2;
  }

  jump() {
    if (this.jumpsUsed >= this.maxJumps) {
      return false;
    }
    const second = this.jumpsUsed === 1;
    this.jumpsUsed += 1;
    this.verticalVelocity = -this.jumpSpeed * (second ? 0.88 : 1);
    this.grounded = false;
    this.airTime = 0;
    this.landTimer = 0;
    // Jumping out of a kick gives control back to the jump animation.
    this.stateLock = false;
    this.setState('rise');
    if (second) {
      this.doubleFlash = 0.4;
    }
    return second ? 'second' : 'first';
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.stateTime = 0;
    }
  }

  setDefeat() {
    this.setState('defeat');
  }

  update(deltaTime) {
    // While the kick plays it owns the state, so the vertical physics must
    // not steal it — otherwise an airborne kick would be overwritten by the
    // jump animation and the hitbox would disappear.
    this.stateLock = this.state === 'kick';
    const wasGrounded = this.grounded;
    stepVertical(this, deltaTime, this.gravity);
    if (!wasGrounded && this.grounded && this.state !== 'kick') {
      this.setState('land');
    }
    if (this.kickTime < KICK_COOLDOWN_END) {
      this.kickTime = Math.min(this.kickTime + deltaTime, KICK_COOLDOWN_END);
      if (this.state === 'kick' && this.kickTime >= KICK_END) {
        // The kick is over: the vertical physics owns the state again.
        this.stateLock = false;
        // A kick thrown in mid-air hands control back to the jump; a kick
        // that ended with him on the ground returns to the run, or to the
        // landing if he touched down during the recovery.
        if (this.kickFromAir && !this.grounded) {
          this.setState(this.verticalVelocity < 0 ? 'rise' : 'fall');
        } else if (this.landTimer > 0) {
          this.setState('land');
        } else {
          this.setState(this.together ? 'together' : 'run');
        }
      }
    }
  }

  updateVisual(deltaTime) {
    this.time += deltaTime;
    this.stateTime += deltaTime;
    this.doubleFlash = Math.max(0, this.doubleFlash - deltaTime);

    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.blink = true;
      this.blinkTimer = 2 + Math.random() * 3;
      this.blinkHold = 0;
    }
    if (this.blink) {
      this.blinkHold += deltaTime;
      if (this.blinkHold >= 0.12) {
        this.blink = false;
      }
    }

    if (this.state === 'land') {
      this.landTimer -= deltaTime;
      if (this.landTimer <= 0) {
        this.setState(this.together ? 'together' : 'run');
      }
    }

    const cycling = ['run', 'together'].includes(this.state);
    if (cycling) {
      this.cycle = (this.cycle + deltaTime / BOY_SPEC.cycleSeconds) % 1;
    }

    // Occasional glance back at her once they run together.
    const glancePhase = (this.time % 4.5) / 0.7;
    this.glance = glancePhase < 1 ? Math.sin(Math.PI * glancePhase) : 0;

    const target = computePose(BOY_SPEC, {
      state: this.state,
      cycle: this.cycle,
      time: this.time,
      airTime: this.airTime,
      stateTime: this.stateTime,
      landT: Math.max(0, this.landTimer / LAND_DURATION),
      glance: this.glance,
      blink: this.blink,
      doubleJump: this.doubleFlash > 0,
      kissT: this.kissT,
      faceOverride: this.faceOverride,
      speaking: this.speaking,
      kickT: this.kickTime,
    });
    // The reunion slows the blend so kneeling, standing and leaning read as
    // one continuous motion instead of three pops.
    const rate = this.poseBlendRate ?? 26;
    this.pose = blendPose(this.pose, target, 1 - Math.exp(-deltaTime * rate));
  }

  getBounds() {
    return {
      x: this.x + 5,
      y: this.y + 3,
      width: this.width - 10,
      height: this.height - 3,
    };
  }

  drawShadow(view) {
    const gap = GROUND_Y - (this.y + this.height);
    const alpha = Math.max(0, 1 - gap / 140) * 0.45;
    if (alpha > 0.02) {
      view.rect(this.x + 4, GROUND_Y - 2, 32, 4, '#0B0618', alpha);
    }
  }

  // `flip` mirrors the whole rig so he can face her during the kiss.
  draw(view, { flip = false } = {}) {
    if (!this.pose) {
      return;
    }
    const centerX = this.x + this.width / 2;
    const draw = () => drawCharacter(view, BOY_SPEC, this.pose, {
      x: centerX,
      y: this.y + this.height,
      time: this.time,
    });
    if (flip) {
      view.mirror(centerX, draw);
    } else {
      draw();
    }
  }
}
