import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from './config.js';
import { mixColor } from './palette.js';
import {
  RAIN_BASE_DROPS, RAIN_MAX_DROPS, RAIN_MAX_INTENSITY,
} from './config.js';

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

/**
 * The storm of the solo section: heavy clouds, slanted rain and rare, soft
 * lightning. Everything fades out through `mood` (0 = full storm, 1 = the
 * world has awakened), and flashes are gentle by design — brief sky brightening,
 * never a full-screen strobe.
 */
export class Weather {
  constructor() {
    this.time = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const random = randomSource(775511);

    // How much heavier the storm has become. The game raises this as the
    // runner collects crystals; the rain eases toward the target so the
    // change never pops.
    this.intensity = 0;
    this.targetIntensity = 0;

    this.clouds = Array.from({ length: 6 }, (_, index) => ({
      x: (index / 6) * GAME_WIDTH + random() * 140,
      y: 40 + random() * 90,
      width: 110 + random() * 110,
      height: 16 + random() * 16,
      speed: 6 + random() * 10,
    }));

    this.drops = Array.from({ length: RAIN_BASE_DROPS }, () => this.makeDrop(random));

    // Fixed jagged bolt path so every strike looks hand-drawn but stable.
    this.boltPoints = [];
    let boltX = 0;
    let boltY = 0;
    for (let index = 0; index < 9; index += 1) {
      boltX += (random() - 0.35) * 26;
      boltY += 26 + random() * 16;
      this.boltPoints.push({ x: boltX, y: boltY });
    }

    this.strikeTimer = 4 + random() * 5;
    this.flashTime = 0;
    this.flashX = GAME_WIDTH * 0.5;
    this.flashGlow = 0;
  }

  // One rain drop, used for the initial pool and for any added later.
  makeDrop(random = Math.random) {
    return {
      x: random() * GAME_WIDTH,
      y: random() * GROUND_Y,
      speed: 460 + random() * 240,
      length: 7 + random() * 7,
      layer: random() < 0.4 ? 0.6 : 1,
    };
  }

  // Raises the storm as the run progresses: more drops, faster and brighter
  // rain. The transition is eased inside update(), so the change is smooth.
  // `level` runs from 0 (the base storm) to RAIN_MAX_INTENSITY (the worst
  // weather the five crystals can bring).
  setIntensity(level) {
    const clamped = Math.max(0, Math.min(RAIN_MAX_INTENSITY, level));
    this.targetIntensity = clamped;
    // The drop count follows the intensity on a straight line, so every step
    // of the storm adds the same amount of rain.
    const share = RAIN_MAX_INTENSITY === 0 ? 0 : clamped / RAIN_MAX_INTENSITY;
    const wanted = Math.min(
      RAIN_MAX_DROPS,
      RAIN_BASE_DROPS + Math.round(share * (RAIN_MAX_DROPS - RAIN_BASE_DROPS)),
    );
    // Grow the pool one drop at a time so the storm builds up gradually.
    while (this.drops.length < wanted) {
      this.drops.push(this.makeDrop());
    }
  }

  update(deltaTime, mood) {
    this.time += deltaTime;
    const calm = Math.max(0, 1 - mood);

    // The storm eases toward its target intensity instead of snapping.
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, deltaTime * 1.6);

    for (const drop of this.drops) {
      // Heavier rain falls faster.
      drop.y += drop.speed * (1 + this.intensity * 0.8) * deltaTime;
      drop.x -= drop.speed * (1 + this.intensity * 0.8) * deltaTime * 0.22;
      if (drop.y > GROUND_Y) {
        drop.y = -12;
        drop.x = mod(drop.x + 180 + Math.random() * 120, GAME_WIDTH + 60);
      }
      if (drop.x < -30) {
        drop.x += GAME_WIDTH + 60;
      }
    }

    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed * deltaTime;
      if (cloud.x < -cloud.width - 40) {
        cloud.x = GAME_WIDTH + 40;
      }
    }

    if (this.flashTime > 0) {
      this.flashTime = Math.max(0, this.flashTime - deltaTime);
      const t = this.flashTime / 0.34;
      // Two soft flickers inside one strike window.
      this.flashGlow = calm * 0.1 * t * (0.6 + 0.4 * Math.sin(t * 34));
    } else {
      this.flashGlow = 0;
      if (!this.reducedMotion && calm > 0.35) {
        this.strikeTimer -= deltaTime;
        if (this.strikeTimer <= 0) {
          this.strikeTimer = 6 + Math.random() * 7;
          this.flashTime = 0.34;
          this.flashX = 120 + Math.random() * (GAME_WIDTH - 260);
        }
      }
    }
  }

  // Heavy clouds that lighten, rise and thin out as the world awakens.
  drawClouds(view, scroll, mood) {
    const calm = Math.max(0, 1 - mood);
    const rise = mood * 46;
    for (const cloud of this.clouds) {
      const x = mod(cloud.x - scroll * 0.08, GAME_WIDTH + 260) - 130;
      const y = cloud.y - rise;
      const dark = mixColor('#241740', '#FFFFFF', mood);
      const light = mixColor('#33205A', '#F2F6FF', mood);
      const alpha = 0.55 + calm * 0.25;
      view.rect(x, y, cloud.width, cloud.height, dark, alpha);
      view.rect(x + 14, y - 9, cloud.width * 0.5, 11, light, alpha * 0.85);
      view.rect(x + cloud.width * 0.45, y - 6, cloud.width * 0.35, 8, light, alpha * 0.7);
      view.rect(x + 8, y + cloud.height, cloud.width - 24, 3, mixColor('#3D5A2A', '#DCE8FF', mood), 0.3 * calm + 0.12);
      // Rain trailing under the heaviest clouds.
      if (calm > 0.15) {
        view.rect(x + 18, y + cloud.height + 5, 3, 7, '#8FA8D8', 0.18 * calm);
        view.rect(x + cloud.width * 0.5, y + cloud.height + 9, 3, 9, '#8FA8D8', 0.14 * calm);
      }
    }
  }

  drawRain(view, scroll, mood) {
    const calm = Math.max(0, 1 - mood);
    if (calm < 0.02) {
      return;
    }
    // A heavier storm draws more drops and paints them brighter, but the
    // alpha stays low so the gameplay behind the rain is never hidden.
    const strength = 1 + this.intensity * 1.4;
    for (const drop of this.drops) {
      const x = mod(drop.x - scroll * 0.12 * drop.layer, GAME_WIDTH + 40) - 20;
      const length = drop.length * (1 + this.intensity * 0.5);
      view.rect(x, drop.y, 2, length, '#9FB6E8', 0.24 * calm * drop.layer * strength);
      view.rect(x, drop.y + length, 2, 2, '#C8D6FF', 0.12 * calm * strength);
    }
  }

  // The bolt itself, drawn with the clouds so it stays behind the action.
  drawBolt(view, mood) {
    if (this.flashTime <= 0) {
      return;
    }
    const calm = Math.max(0, 1 - mood);
    const alpha = Math.min(1, (this.flashTime / 0.34) * 2.2) * calm;
    const baseX = this.flashX;
    const baseY = 70;
    view.rect(baseX - 26, baseY - 12, 52, 3, '#C8A7FF', 0.35 * alpha);
    for (let index = 0; index < this.boltPoints.length - 1; index += 1) {
      const from = this.boltPoints[index];
      const to = this.boltPoints[index + 1];
      view.line(baseX + from.x, baseY + from.y, baseX + to.x, baseY + to.y, 4, '#E9DBFF', 0.5 * alpha);
      view.line(baseX + from.x, baseY + from.y, baseX + to.x, baseY + to.y, 2, '#FFFFFF', 0.85 * alpha);
    }
  }
}
