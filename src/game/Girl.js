import { GIRL_SPEC, computePose, blendPose } from './characterSpec.js';
import { drawCharacter } from './characterRender.js';
import { GROUND_Y } from './config.js';
import { stepVertical, LAND_DURATION } from './physics.js';

// She waits ahead on the path, joins the reunion scene, and from then on runs
// beside him with her own gravity, jump counter and landing detection while
// sharing his input.
export class Girl {
  constructor(groundY) {
    this.groundY = groundY;
    this.width = 36;
    this.height = GIRL_SPEC.height;
    this.gravity = 2150;
    this.jumpSpeed = 780;
    this.reset();
  }

  reset() {
    this.active = false;
    this.mode = 'off';
    this.x = -80;
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
    this.glance = 0;
    this.pendingJump = false;
    this.dead = false;
    this.jumpDelay = 0;
    this.faceOverride = null;
    this.speaking = false;
    this.blinkTimer = 1.4;
    this.blink = false;
    this.blinkHold = 0;
    this.followX = 0;
    // She never performs a kick, so the vertical physics always owns her
    // state; the flag keeps the shared code path honest.
    this.stateLock = false;
    // Set during the reunion for a softer cinematic blend.
    this.poseBlendRate = null;
  }

  // All crystals collected: she takes her place further down the path.
  placeAhead(screenX) {
    this.active = true;
    this.mode = 'wait';
    this.x = screenX;
    this.y = this.groundY - this.height;
    this.grounded = true;
    this.setState('idle');
  }

  beginReunion() {
    this.mode = 'reunion';
  }

  startTogether(playerX) {
    this.mode = 'together';
    this.maxJumps = 2;
    this.followX = playerX - 46;
    this.x = this.followX;
    this.setState('together');
  }

  // Once the baby joins the family, a third jump opens up for her too.
  unlockTripleJump() {
    this.maxJumps = 3;
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.stateTime = 0;
    }
  }

  setDefeat() {
    if (this.active) {
      this.setState('defeat');
    }
  }

  // The shared input lands on her a beat after him, so the couple feels
  // natural instead of mechanically identical.
  requestJump(delay = 0.07) {
    if (this.mode !== 'together') {
      return false;
    }
    this.pendingJump = true;
    this.jumpDelay = delay;
    return true;
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
    this.setState('rise');
    if (second) {
      this.doubleFlash = 0.4;
    }
    return second ? 'second' : 'first';
  }

  // Collision box for the shared family life system.
  getBounds() {
    return {
      x: this.x + 4,
      y: this.y + 3,
      width: this.width - 8,
      height: this.height - 3,
    };
  }

  update(deltaTime, player, travelDistance) {
    if (!this.active || this.dead) {
      return;
    }

    if (this.mode === 'wait') {
      // She is part of the world, so she slides back as the road scrolls.
      this.x -= travelDistance;
      if (player.x > this.x - 360 && this.state !== 'greet') {
        this.setState('greet');
      }
      return;
    }

    if (this.mode === 'reunion') {
      // The scene drives her position and pose directly.
      return;
    }

    // Running together: her own vertical physics, his horizontal position.
    if (this.pendingJump) {
      this.jumpDelay -= deltaTime;
      if (this.jumpDelay <= 0) {
        this.pendingJump = false;
        this.jump();
      }
    }

    // A dead Samuel no longer leads; she holds her own spot on the road.
    if (!player.dead) {
      this.followX = player.x - 46;
    }
    this.x += (this.followX - this.x) * (1 - Math.exp(-deltaTime * 9));
    stepVertical(this, deltaTime, this.gravity);
  }

  updateVisual(deltaTime) {
    if (!this.active || this.dead) {
      return;
    }
    this.time += deltaTime;
    this.stateTime += deltaTime;
    this.doubleFlash = Math.max(0, this.doubleFlash - deltaTime);
    this.landTimer = Math.max(0, this.landTimer - deltaTime);

    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.blink = true;
      this.blinkTimer = 2.4 + Math.random() * 3;
      this.blinkHold = 0;
    }
    if (this.blink) {
      this.blinkHold += deltaTime;
      if (this.blinkHold >= 0.12) {
        this.blink = false;
      }
    }

    if (this.state === 'land' && this.landTimer <= 0) {
      this.setState(this.mode === 'together' ? 'together' : 'idle');
    }

    if (['run', 'together', 'greet'].includes(this.state)) {
      this.cycle = (this.cycle + deltaTime / GIRL_SPEC.cycleSeconds) % 1;
    }

    // Together she keeps glancing at him: he runs on her right side.
    this.glance = this.mode === 'together' ? -1 : 0;

    const target = computePose(GIRL_SPEC, {
      state: this.state,
      cycle: this.cycle,
      time: this.time,
      airTime: this.airTime,
      stateTime: this.stateTime,
      landT: this.landTimer / LAND_DURATION,
      glance: this.glance,
      blink: this.blink,
      doubleJump: this.doubleFlash > 0,
      kissT: this.kissT,
      faceOverride: this.faceOverride,
      speaking: this.speaking,
    });
    const rate = this.poseBlendRate ?? 24;
    this.pose = blendPose(this.pose, target, 1 - Math.exp(-deltaTime * rate));
  }

  drawShadow(view) {
    if (!this.active || this.x < -20) {
      return;
    }
    const gap = GROUND_Y - (this.y + this.height);
    const alpha = Math.max(0, 1 - gap / 140) * 0.4;
    if (alpha > 0.02) {
      view.rect(this.x + 4, GROUND_Y - 2, 28, 4, '#0B0618', alpha);
    }
  }

  draw(view, { flip = false } = {}) {
    if (!this.active || !this.pose || this.x < -40) {
      return;
    }
    const centerX = this.x + this.width / 2;
    const draw = () => drawCharacter(view, GIRL_SPEC, this.pose, {
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
