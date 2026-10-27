import { GROUND_Y } from './config.js';
import { stepVertical } from './physics.js';

// The family's smallest runner: after the required kisses a tiny baby trots
// in from behind and joins the couple. A self-contained mini-rig in the same
// pixel style — a dark little tuft like Samuel's hair with a caramel curl
// like Ali's, a soft pink onesie and white booties — so the family reads as
// one group without touching the shared character system.
//
// He uses the same vertical physics helper as his parents (stepVertical), so
// his jump arc, landing and double jump behave exactly like theirs.
export class Baby {
  constructor(targetX) {
    this.width = 22;
    this.height = 26;
    this.x = -30;
    this.targetX = targetX;
    this.groundY = GROUND_Y;
    this.y = GROUND_Y - this.height;
    this.state = 'enter';
    this.time = 0;
    this.cycle = 0;
    this.dead = false;

    // Vertical physics, shared with the rest of the family.
    this.verticalVelocity = 0;
    this.grounded = true;
    this.airTime = 0;
    this.landTimer = 0;
    this.jumpsUsed = 0;
    this.maxJumps = 2;
    this.gravity = 2100;
    this.jumpSpeed = 700;
  }

  // Collision box for the shared family life system (used once the baby is
  // the last family member standing). It follows his real body, jump included.
  getBounds() {
    return {
      x: this.x + 3,
      y: this.y + 4,
      width: this.width - 6,
      height: this.height - 4,
    };
  }

  // A real jump: the same input path as his parents, with a double jump of
  // his own. Returns 'first', 'second' or false when he is out of jumps.
  jump() {
    if (this.jumpsUsed >= this.maxJumps || this.state === 'enter') {
      return false;
    }
    const used = this.jumpsUsed;
    this.jumpsUsed += 1;
    this.verticalVelocity = -this.jumpSpeed * (used === 0 ? 1 : 0.88);
    this.grounded = false;
    this.airTime = 0;
    this.landTimer = 0;
    return used === 0 ? 'first' : 'second';
  }

  update(deltaTime, scrollSpeed = 0) {
    this.time += deltaTime;
    if (this.state === 'enter') {
      // Screen space: he catches up to the running group at the very speed of
      // the road, so he never looks slower than the world he is running on.
      this.x += scrollSpeed * deltaTime;
      if (this.x >= this.targetX) {
        this.x = this.targetX;
        this.state = 'run';
      }
    }
    stepVertical(this, deltaTime, this.gravity);
    this.landTimer = Math.max(0, this.landTimer - deltaTime);
    if (this.state === 'run') {
      // Same cadence as Samuel's stride, so the three of them read as one
      // running group instead of a scuttling toddler.
      this.cycle = (this.cycle + deltaTime / 0.38) % 1;
    }
  }

  draw(view) {
    const cx = this.x + this.width / 2;
    const ground = this.y + this.height;
    const air = !this.grounded;

    // Shadow stays on the road and softens while he is in the air.
    const height = this.groundY - ground;
    const shadowAlpha = Math.max(0.1, 0.4 - height * 0.012);
    view.rect(cx - 8, this.groundY - 2, 16, 4, '#0B0618', shadowAlpha);

    // While he runs: the same leg cycle as his parents. While he jumps: legs
    // tucked up, so the jump reads clearly.
    const phase = this.cycle * Math.PI * 2;
    const stride = air ? 0 : Math.cos(phase) * 5;
    const lift = air ? 3 : Math.max(0, -Math.sin(phase)) * 4;
    const bob = air ? 0 : Math.abs(Math.sin(phase)) * 1.4;
    const top = ground - bob;

    // Legs and booties: alternating little strides, tucked in the air.
    view.rect(cx - 5 + stride, top - 7 - lift, 5, 7, '#FFD3B0');
    view.rect(cx + 1 - stride, top - 7 - lift, 5, 7, '#EDB795');
    view.rect(cx - 6 + stride, top - 3 - lift, 6, 3, '#FFF5FC');
    view.rect(cx + 1 - stride, top - 3 - lift, 6, 3, '#F4E4EE');

    // Soft onesie with a lighter tummy and a lime snap line — the family's
    // pink from Ali with Samuel's accent.
    view.rect(cx - 7, top - 17, 14, 11, '#FF6FB8');
    view.rect(cx - 7, top - 17, 14, 2, '#FFC2E0');
    view.rect(cx - 5, top - 13, 10, 6, '#FFC2E0');
    view.rect(cx - 7, top - 8, 14, 2, '#B7FF4A');
    view.rect(cx - 7, top - 17, 2, 11, '#E8479B');

    // Pumping arms.
    view.rect(cx - 9, top - 16 + stride * 2, 3, 7, '#FFD3B0');
    view.rect(cx + 6, top - 16 - stride * 2, 3, 7, '#EDB795');

    // Big baby head: dark tuft, one caramel curl, wide eyes and a smile.
    view.rect(cx - 8, top - 29, 16, 12, '#FFD3B0');
    view.rect(cx - 8, top - 29, 16, 4, '#120E22');
    view.rect(cx - 8, top - 25, 3, 5, '#120E22');
    view.rect(cx + 5, top - 31, 5, 4, '#8C4B2E');
    view.rect(cx + 6, top - 32, 3, 2, '#E5A96B');
    const blinking = Math.sin(this.time * 1.3) > 0.94;
    if (blinking) {
      view.rect(cx - 5, top - 23, 4, 1, '#1B1230');
      view.rect(cx + 1, top - 23, 4, 1, '#1B1230');
    } else {
      view.rect(cx - 5, top - 24, 3, 3, '#1B1230');
      view.rect(cx + 2, top - 24, 3, 3, '#1B1230');
      view.rect(cx - 4, top - 24, 1, 1, '#FFFFFF');
      view.rect(cx + 3, top - 24, 1, 1, '#FFFFFF');
    }
    view.rect(cx - 7, top - 21, 2, 2, '#FF5FA8', 0.8);
    view.rect(cx + 5, top - 21, 2, 2, '#FF5FA8', 0.8);
    view.rect(cx - 1, top - 20, 4, 2, '#5A1B45');
    view.rect(cx, top - 19, 2, 1, '#FF69D4');
  }
}
