import { GROUND_Y, SURVIVAL_THROW_INTERVAL } from './config.js';

/**
 * A stylized guerrilla fighter for the survival event: olive fatigues, a
 * green beret, a backpack and a big caricature jaw — instantly distinct from
 * the curvy bichis, the scenery, the signs and every collectible. He jogs in
 * from off screen, telegraphs with a raised arm and a blinking mark, then
 * lobs a spinning chancleta at the family. Cartoonish and bloodless: the
 * threat reads as absurd, never graphic, and never political.
 *
 * The class is pure presentation + timing: it returns one fire event per
 * throw and Game owns the projectiles, the collision and the lives.
 */
export class Guerrilla {
  // firstThrowDelay keeps the first lob after the warning phase, so the
  // survival clock always starts before any damage can fly.
  constructor(x, groundY, targetX, firstThrowDelay) {
    this.x = x;
    this.targetX = targetX;
    this.groundY = groundY;
    this.width = 38;
    this.height = 58;
    this.y = groundY - this.height;
    this.state = 'enter';
    this.stateTime = 0;
    this.time = 0;
    this.throwTimer = firstThrowDelay;
    this.phase = Math.random() * 6.28;
    this.remove = false;
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  // Advances the fighter and returns one `{}` per shot he lobs this frame.
  update(deltaTime) {
    this.time += deltaTime;
    this.stateTime += deltaTime;
    const fired = [];

    if (this.state === 'enter') {
      const direction = this.targetX > this.x ? 1 : -1;
      this.x += direction * 220 * deltaTime;
      const arrived = direction > 0 ? this.x >= this.targetX : this.x <= this.targetX;
      if (arrived) {
        this.x = this.targetX;
        this.setState('idle');
      }
      return fired;
    }

    if (this.state === 'idle') {
      this.throwTimer -= deltaTime;
      if (this.throwTimer <= 0) {
        this.setState('aim');
      }
      return fired;
    }

    if (this.state === 'aim') {
      // The wind-up: arm raised, mark blinking — the family's cue to jump.
      if (this.stateTime >= 0.6) {
        this.setState('throw');
        this.throwTimer = SURVIVAL_THROW_INTERVAL + Math.random() * 0.5;
        fired.push({});
      }
      return fired;
    }

    // 'throw': brief follow-through, then back to the ready stance.
    if (this.stateTime >= 0.35) {
      this.setState('idle');
    }
    return fired;
  }

  draw(view) {
    const cx = this.x + this.width / 2;
    const ground = this.groundY;
    view.rect(cx - 16, ground - 2, 32, 4, '#0B0618', 0.5);

    const stride = this.state === 'enter' ? Math.sin(this.time * 12) * 5 : 0;
    const bob = this.state === 'enter' ? Math.abs(Math.sin(this.time * 12)) * 1.5
      : Math.sin(this.time * 5 + this.phase) * 1;
    const top = ground - bob;

    // Legs and heavy boots: a wide braced stance while he throws.
    view.rect(cx - 10 + stride, top - 20, 8, 14, '#48521F');
    view.rect(cx + 2 - stride, top - 20, 8, 14, '#3E4A1E');
    view.rect(cx - 13 + stride, top - 7, 13, 7, '#3A2E22');
    view.rect(cx + 1 - stride, top - 7, 13, 7, '#2E241A');

    // Backpack hump, behind him and away from the family.
    view.rect(cx + 7, top - 44, 13, 15, '#4A5426');
    view.rect(cx + 9, top - 42, 9, 4, '#6B7A33');

    // Torso with a load-bearing vest and pouches.
    view.rect(cx - 12, top - 40, 24, 22, '#5F6B36');
    view.rect(cx - 12, top - 40, 24, 3, '#78853F');
    view.rect(cx - 10, top - 36, 20, 14, '#3E4A1E');
    view.rect(cx - 8, top - 34, 6, 5, '#6B5B2E');
    view.rect(cx + 2, top - 34, 6, 5, '#6B5B2E');
    view.rect(cx - 12, top - 40, 3, 22, '#78853F', 0.6);

    // Head in profile facing the family: heavy jaw, squint, beret.
    view.rect(cx - 10, top - 56, 18, 15, '#C98A5B');
    view.rect(cx - 12, top - 50, 4, 7, '#C98A5B');
    view.rect(cx - 10, top - 56, 18, 3, '#A9713F');
    view.rect(cx - 9, top - 44, 14, 3, '#A9713F');
    view.rect(cx - 9, top - 43, 3, 2, '#8C5A34');
    view.rect(cx - 7, top - 55, 8, 2, '#3A2E22');
    view.rect(cx - 6, top - 52, 6, 2, '#FFF5FC');
    view.rect(cx - 5, top - 51, 4, 1, '#1B1230');
    view.rect(cx - 8, top - 47, 6, 2, '#5A1B45');
    view.rect(cx - 11, top - 60, 20, 5, '#3E4A1E');
    view.rect(cx - 13, top - 58, 6, 3, '#333B14');
    view.rect(cx + 5, top - 61, 6, 3, '#333B14');

    if (this.state === 'aim') {
      // Raised arm and a blinking mark: the readable wind-up cue.
      view.rect(cx - 16, top - 53, 5, 15, '#5F6B36');
      view.rect(cx - 17, top - 57, 6, 6, '#C98A5B');
      if (Math.sin(this.time * 14) > -0.4) {
        const markY = top - 80;
        view.rect(cx - 8, markY, 18, 20, '#FFF5FC', 0.92);
        view.rect(cx - 6, markY + 2, 14, 16, '#B6303C');
        view.rect(cx - 1, markY + 4, 4, 8, '#FFF5FC');
        view.rect(cx - 1, markY + 14, 4, 3, '#FFF5FC');
      }
    } else if (this.state === 'throw') {
      // Arm thrust forward on the release.
      view.rect(cx - 23, top - 39, 15, 5, '#5F6B36');
      view.rect(cx - 27, top - 40, 6, 6, '#C98A5B');
    } else {
      view.rect(cx - 15, top - 38, 5, 13, '#5F6B36');
      view.rect(cx - 15, top - 26, 6, 6, '#C98A5B');
    }
  }
}

// The projectile: a spinning chancleta. Drawn by Game so it can live with
// the other on-screen shots, but kept here with the fighter's art direction.
export function drawChancleta(view, shot, time) {
  const spin = shot.spin ?? 0;
  const cx = shot.x + shot.width / 2;
  const cy = shot.y + shot.height / 2;
  view.rect(shot.x - 14, shot.y + 5, 14, 3, '#FF9E3D', 0.4);
  view.glow(shot.x - 6, shot.y - 4, shot.width + 14, shot.height + 8, '#FFE66D', 0.1, 1);
  const squash = Math.abs(Math.cos(spin));
  const soleW = shot.width * (0.55 + 0.45 * squash);
  // Sole and strap: a tiny slipper tumbling end over end.
  view.rect(cx - soleW / 2, cy - 3, soleW, 6, '#2E5A6B');
  view.rect(cx - soleW / 2, cy + 1, soleW, 2, '#1C3B47');
  view.rect(cx - soleW / 4, cy - 5, Math.max(4, soleW / 2), 3, '#5FA0B8');
  if (squash > 0.6) {
    view.rect(cx - 2, cy - 6, 4, 2, '#8FD4E8');
  }
}
